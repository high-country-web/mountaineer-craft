package routes

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
)

type minecraftAccounts struct {
	db  *sql.DB
	err error
}

func newMinecraftAccounts() *minecraftAccounts {
	accounts := &minecraftAccounts{}
	host := strings.TrimSpace(os.Getenv("PLAN_DB_HOST"))
	if host == "" {
		return accounts
	}
	port := os.Getenv("PLAN_DB_PORT")
	if port == "" {
		port = "3306"
	}
	portNumber, err := strconv.Atoi(port)
	tlsMode := os.Getenv("PLAN_DB_TLS")
	if tlsMode == "" {
		tlsMode = "true"
	}
	if err != nil || portNumber < 1 || portNumber > 65535 ||
		os.Getenv("PLAN_DB_NAME") == "" || os.Getenv("PLAN_DB_USER") == "" ||
		(tlsMode != "true" && tlsMode != "false") {
		accounts.err = errors.New("invalid Plan database configuration")
		log.Print("[ERROR] Minecraft account lookup: invalid database configuration")
		return accounts
	}
	config := mysql.NewConfig()
	config.User = os.Getenv("PLAN_DB_USER")
	config.Passwd = os.Getenv("PLAN_DB_PASSWORD")
	config.Net = "tcp"
	config.Addr = net.JoinHostPort(host, port)
	config.DBName = os.Getenv("PLAN_DB_NAME")
	config.TLSConfig = tlsMode
	config.Timeout = 3 * time.Second
	config.ReadTimeout = 3 * time.Second
	config.WriteTimeout = 3 * time.Second
	accounts.db, accounts.err = sql.Open("mysql", config.FormatDSN())
	if accounts.err != nil {
		log.Print("[ERROR] Minecraft account lookup: could not initialize database")
		return accounts
	}
	accounts.db.SetMaxOpenConns(3)
	accounts.db.SetMaxIdleConns(2)
	accounts.db.SetConnMaxLifetime(3 * time.Minute)
	return accounts
}

// Plan's cached Discord username is a profile suggestion, never proof of account
// ownership. It does not affect authentication, membership, or permissions.
const minecraftProfileQuery = `SELECT DISTINCT values_table.uuid
	FROM plan_extension_user_values AS values_table
	JOIN plan_extension_providers AS provider ON provider.id = values_table.provider_id
	JOIN plan_extension_plugins AS plugin ON plugin.id = provider.plugin_id
	WHERE plugin.name = 'DiscordSRV' AND provider.name = 'username'
	AND LOWER(TRIM(LEADING '@' FROM TRIM(values_table.string_value))) = LOWER(?)
	LIMIT 2`

func (accounts *minecraftAccounts) handler(directory *playerDirectory) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "private, no-store")
		if accounts.err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "minecraft_account_unavailable"})
			return
		}
		if accounts.db == nil {
			c.JSON(http.StatusOK, gin.H{"status": "not_configured"})
			return
		}
		session := c.MustGet("discord_session").(discordSession)
		ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
		defer cancel()
		var currentUser discordUser
		if err := discordGet(ctx, session.AccessToken, "/users/@me", &currentUser); err != nil || currentUser.ID != session.User.ID || currentUser.Username == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "minecraft_account_unavailable"})
			return
		}
		var uuid string
		rows, err := accounts.db.QueryContext(ctx, minecraftProfileQuery, currentUser.Username)
		if err != nil {
			log.Print("[ERROR] Minecraft profile suggestion: database query failed")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "minecraft_account_unavailable"})
			return
		}
		count := 0
		for rows.Next() {
			if err = rows.Scan(&uuid); err != nil || !playerUUID.MatchString(uuid) {
				err = errors.New("invalid player UUID")
				break
			}
			count++
		}
		if err == nil {
			err = rows.Err()
		}
		rows.Close()
		if err != nil {
			log.Print("[ERROR] Minecraft profile suggestion: invalid database result")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "minecraft_account_unavailable"})
			return
		}
		if count != 1 {
			status := "no_match"
			if count > 1 {
				status = "ambiguous"
			}
			c.JSON(http.StatusOK, gin.H{"status": status})
			return
		}
		uuid = strings.ToLower(uuid)
		var linkedPlayer *publicPlayer
		directory.mu.Lock()
		players, listErr := directory.list(ctx)
		if listErr == nil {
			for _, player := range players {
				if player.UUID == uuid {
					linkedPlayer = &player
					break
				}
			}
		}
		directory.mu.Unlock()
		if linkedPlayer == nil {
			if listErr != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "minecraft_account_unavailable"})
			} else {
				c.JSON(http.StatusOK, gin.H{"status": "no_match"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "matched", "uuid": uuid, "player": linkedPlayer})
	}
}
