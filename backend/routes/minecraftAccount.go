package routes

import (
	"bufio"
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type minecraftAccounts struct {
	path     string
	endpoint string
	apiKey   string
	client   *http.Client
	err      error
}

func newMinecraftAccounts() *minecraftAccounts {
	accounts := &minecraftAccounts{path: strings.TrimSpace(os.Getenv("DISCORDSRV_ACCOUNTS_FILE"))}
	panelURL := strings.TrimSpace(os.Getenv("PTERODACTYL_PANEL_URL"))
	serverID := strings.TrimSpace(os.Getenv("PTERODACTYL_MINECRAFT_SERVER_ID"))
	accounts.apiKey = strings.TrimSpace(os.Getenv("PTERODACTYL_CLIENT_API_KEY"))
	// Any Panel setting selects API mode. Partial configuration must fail closed,
	// rather than silently falling back to a potentially stale local file.
	if panelURL != "" || serverID != "" || accounts.apiKey != "" {
		accounts.endpoint, accounts.err = minecraftAccountsEndpoint(panelURL, serverID, accounts.apiKey)
		accounts.client = &http.Client{
			Timeout:       5 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
		}
	}
	return accounts
}

var discordAccountID = regexp.MustCompile(`^[0-9]{17,20}$`)
var panelServerID = regexp.MustCompile(`^[0-9a-fA-F]{8}$`)

func minecraftAccountsEndpoint(panelURL, serverID, apiKey string) (string, error) {
	endpoint, err := pterodactylServerEndpoint(panelURL, serverID, apiKey)
	if err != nil {
		return "", err
	}
	query := url.Values{"file": {"/plugins/DiscordSRV/accounts.aof"}}.Encode()
	return endpoint + "/files/contents?" + query, nil
}

func pterodactylServerEndpoint(panelURL, serverID, apiKey string) (string, error) {
	base, err := url.Parse(panelURL)
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil ||
		base.RawQuery != "" || base.Fragment != "" || !panelServerID.MatchString(serverID) ||
		apiKey == "" || strings.ContainsAny(apiKey, "\r\n") {
		return "", errors.New("invalid Pterodactyl account lookup configuration")
	}
	base.Path = strings.TrimRight(base.Path, "/") + "/api/client/servers/" + serverID
	base.RawPath = ""
	return base.String(), nil
}

// Replay DiscordSRV's append-only links and removals in file order.
// DiscordSRV owns verification and is the only writer of this file.
func readMinecraftLinks(reader io.Reader) (map[string]string, error) {
	links := make(map[string]string)
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		remove := strings.HasPrefix(line, "-")
		fields := strings.Fields(strings.TrimPrefix(line, "-"))
		if remove {
			if len(fields) < 1 || len(fields) > 2 {
				return nil, errors.New("invalid account removal")
			}
			for _, field := range fields {
				if discordAccountID.MatchString(field) {
					delete(links, field)
				} else if playerUUID.MatchString(field) {
					for id, uuid := range links {
						if uuid == strings.ToLower(field) {
							delete(links, id)
						}
					}
				} else {
					return nil, errors.New("invalid account removal")
				}
			}
		} else {
			if len(fields) != 2 || !discordAccountID.MatchString(fields[0]) || !playerUUID.MatchString(fields[1]) {
				return nil, errors.New("invalid account link")
			}
			links[fields[0]] = strings.ToLower(fields[1])
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	owners := make(map[string]string)
	for id, uuid := range links {
		if _, exists := owners[uuid]; exists {
			return nil, errors.New("conflicting account links")
		}
		owners[uuid] = id
	}
	return links, nil
}

func (accounts *minecraftAccounts) lookup(ctx context.Context, discordID string) (string, error) {
	if accounts.err != nil {
		return "", accounts.err
	}
	var reader io.ReadCloser
	if accounts.endpoint != "" {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, accounts.endpoint, nil)
		if err != nil {
			return "", errors.New("invalid account request")
		}
		req.Header.Set("Authorization", "Bearer "+accounts.apiKey)
		req.Header.Set("Accept", "application/vnd.pterodactyl.v1+json")
		response, err := accounts.client.Do(req)
		if err != nil {
			return "", errors.New("panel account lookup unavailable")
		}
		if response.StatusCode != http.StatusOK {
			response.Body.Close()
			return "", errors.New("panel account lookup failed")
		}
		reader = response.Body
	} else {
		file, err := os.Open(accounts.path)
		if err != nil {
			return "", err
		}
		reader = file
	}
	defer reader.Close()
	// Fail closed on oversized or incomplete snapshots; never serve stale links.
	const maxSize = 16 << 20
	data, err := io.ReadAll(io.LimitReader(reader, maxSize+1))
	if err != nil || len(data) > maxSize || (len(data) > 0 && data[len(data)-1] != '\n') {
		return "", errors.New("account file unavailable or incomplete")
	}
	links, err := readMinecraftLinks(strings.NewReader(string(data)))
	if err != nil {
		return "", err
	}
	return links[discordID], nil
}

func (accounts *minecraftAccounts) handler(directory *playerDirectory) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "private, no-store")
		if accounts.path == "" && accounts.endpoint == "" && accounts.err == nil {
			c.JSON(http.StatusOK, gin.H{"status": "not_configured"})
			return
		}
		session := c.MustGet("discord_session").(discordSession)
		uuid, err := accounts.lookup(c.Request.Context(), session.User.ID)
		if err != nil {
			log.Print("[ERROR] Minecraft account lookup: could not read DiscordSRV account links")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "minecraft_account_unavailable"})
			return
		}
		if uuid == "" {
			c.JSON(http.StatusOK, gin.H{"status": "not_linked"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
		defer cancel()
		var linkedPlayer *publicPlayer
		directory.mu.Lock()
		players, listErr := directory.list(ctx)
		if listErr == nil {
			for _, player := range players {
				if strings.EqualFold(player.UUID, uuid) {
					linkedPlayer = &player
					break
				}
			}
		}
		directory.mu.Unlock()
		// Plan availability does not change the verified DiscordSRV link.
		c.JSON(http.StatusOK, gin.H{"status": "linked", "uuid": uuid, "player": linkedPlayer})
	}
}
