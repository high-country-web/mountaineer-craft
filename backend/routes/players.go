package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Explicit public fields: never forward Plan connections, extensions or account data.
type publicPlayer struct {
	UUID           string `json:"uuid"`
	Name           string `json:"name"`
	Registered     *int64 `json:"registered"`
	LastSeen       *int64 `json:"last_seen"`
	ActivePlaytime *int64 `json:"active_playtime"`
	Sessions       *int64 `json:"sessions"`
	Online         *bool  `json:"online,omitempty"`
	Deaths         *int64 `json:"deaths,omitempty"`
	MobKills       *int64 `json:"mob_kills,omitempty"`
	PlayerKills    *int64 `json:"player_kills,omitempty"`
}

type playerDirectory struct {
	mu      sync.Mutex
	plan    *planStatusClient
	players []publicPlayer
	until   time.Time
	err     error
}

var playerUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func (d *playerDirectory) request(ctx context.Context, path string, target any) error {
	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.plan.baseURL+path, nil)
		if err != nil {
			return errors.New("invalid analytics configuration")
		}
		resp, err := d.plan.client.Do(req)
		if err != nil {
			return planTransportError("players request", err)
		}
		if resp.StatusCode == 302 || resp.StatusCode == 401 || resp.StatusCode == 403 {
			resp.Body.Close()
			if attempt == 0 {
				if err := d.plan.login(ctx); err != nil {
					return err
				}
				continue
			}
			return errors.New("analytics player access denied")
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("analytics players request: HTTP %d", resp.StatusCode)
		}
		decoder := json.NewDecoder(io.LimitReader(resp.Body, 16<<20))
		if err := decoder.Decode(target); err != nil {
			return errors.New("invalid analytics players payload")
		}
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			return errors.New("invalid analytics players payload: trailing data")
		}
		return nil
	}
	return errors.New("analytics player access denied")
}

func validMetric(n *int64) *int64 {
	if n == nil || *n < 0 {
		return nil
	}
	return n
}

// Caller holds d.mu, including while refreshing, to avoid duplicate upstream work.
func (d *playerDirectory) list(ctx context.Context) ([]publicPlayer, error) {
	if time.Now().Before(d.until) {
		return d.players, d.err
	}
	var payload struct {
		Players *[]struct {
			UUID           string `json:"playerUUID"`
			Name           string `json:"playerName"`
			Registered     *int64 `json:"registered"`
			LastSeen       *int64 `json:"lastSeen"`
			ActivePlaytime *int64 `json:"playtimeActive"`
			Sessions       *int64 `json:"sessionCount"`
		} `json:"players"`
	}
	query := url.Values{}
	if d.plan.server != "" {
		query.Set("server", d.plan.server)
	}
	var err error
	if d.plan.password == "" {
		err = errors.New("analytics is not configured: PLAN_API_PASSWORD is missing")
	} else {
		err = d.request(ctx, "/v1/playersTable?"+query.Encode(), &payload)
	}
	players := make([]publicPlayer, 0)
	if err == nil && payload.Players == nil {
		err = errors.New("invalid analytics players payload: missing players")
	}
	if err == nil {
		seen := make(map[string]bool)
		for _, row := range *payload.Players {
			if !playerUUID.MatchString(row.UUID) || strings.TrimSpace(row.Name) == "" {
				err = errors.New("invalid analytics player identity")
				break
			}
			uuid := strings.ToLower(row.UUID)
			if seen[uuid] {
				continue
			}
			seen[uuid] = true
			players = append(players, publicPlayer{UUID: uuid, Name: row.Name, Registered: validMetric(row.Registered), LastSeen: validMetric(row.LastSeen), ActivePlaytime: validMetric(row.ActivePlaytime), Sessions: validMetric(row.Sessions)})
		}
	}
	d.err, d.until = err, time.Now().Add(30*time.Second)
	if err != nil {
		log.Printf("[ERROR] GET /players: %v", err)
		return nil, err
	}
	sort.Slice(players, func(i, j int) bool { return strings.ToLower(players[i].Name) < strings.ToLower(players[j].Name) })
	d.players = players
	return players, nil
}

func (d *playerDirectory) handler(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	slug := strings.ToLower(c.Param("slug"))
	if slug != "" && !playerUUID.MatchString(slug) {
		c.JSON(404, gin.H{"error": "player_not_found"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 12*time.Second)
	defer cancel()
	d.mu.Lock()
	defer d.mu.Unlock()
	players, err := d.list(ctx)
	if err != nil {
		c.JSON(503, gin.H{"error": "players_unavailable"})
		return
	}
	if slug == "" {
		c.JSON(200, gin.H{"players": players})
		return
	}
	for _, player := range players {
		if player.UUID != slug {
			continue
		}
		var payload struct {
			Info *struct {
				UUID        string `json:"uuid"`
				Online      *bool  `json:"online"`
				Deaths      *int64 `json:"deathCount"`
				MobKills    *int64 `json:"mobKillCount"`
				PlayerKills *int64 `json:"playerKillCount"`
			} `json:"info"`
		}
		if err := d.request(ctx, "/v1/player?player="+url.QueryEscape(player.UUID), &payload); err != nil || payload.Info == nil || !strings.EqualFold(payload.Info.UUID, player.UUID) {
			log.Print("[ERROR] GET /players/:slug: analytics player detail unavailable")
			c.JSON(503, gin.H{"error": "players_unavailable"})
			return
		}
		player.Online, player.Deaths, player.MobKills, player.PlayerKills = payload.Info.Online, validMetric(payload.Info.Deaths), validMetric(payload.Info.MobKills), validMetric(payload.Info.PlayerKills)
		c.JSON(200, player)
		return
	}
	c.JSON(404, gin.H{"error": "player_not_found"})
}

func playersRoutes(group *gin.RouterGroup) {
	baseURL := os.Getenv("PLAN_API_URL")
	if baseURL == "" {
		baseURL = "https://analytics.mountaineercraft.net"
	}
	username := os.Getenv("PLAN_API_USERNAME")
	if username == "" {
		username = "apiuser"
	}
	d := &playerDirectory{plan: newPlanStatusClient(baseURL, username, os.Getenv("PLAN_API_PASSWORD"), os.Getenv("PLAN_SERVER_ID"))}
	group.GET("/players", d.handler)
	group.GET("/players/:slug", d.handler)
}
