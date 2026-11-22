package routes

import (
	"crypto/rand"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// POST /auth/discord exchanges a one-use OAuth code for a server-backed session.
// Non-members may sign in, but protected routes always recheck membership.
func authRoute(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	secret := os.Getenv("JWT_SECRET")
	if secret == "" || os.Getenv("DISCORD_REQUIRED_GUILD_ID") == "" || os.Getenv("DISCORD_CLIENT_ID") == "" || os.Getenv("DISCORD_CLIENT_SECRET") == "" || os.Getenv("DISCORD_REDIRECT_URI") == "" {
		missing := []string{}
		for _, key := range []string{"JWT_SECRET", "DISCORD_REQUIRED_GUILD_ID", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI"} {
			if os.Getenv(key) == "" {
				missing = append(missing, key)
			}
		}
		log.Printf("[ERROR] Discord sign-in: missing settings: %s", strings.Join(missing, ", "))
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "auth_not_configured"})
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Code) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_code"})
		return
	}
	data := url.Values{
		"client_id":     {os.Getenv("DISCORD_CLIENT_ID")},
		"client_secret": {os.Getenv("DISCORD_CLIENT_SECRET")},
		"grant_type":    {"authorization_code"},
		"code":          {body.Code},
		"redirect_uri":  {os.Getenv("DISCORD_REDIRECT_URI")},
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, discordAPI+"/oauth2/token", strings.NewReader(data.Encode()))
	if err != nil {
		log.Print("[ERROR] Discord sign-in: could not construct token exchange request")
		c.JSON(http.StatusBadGateway, gin.H{"error": "discord_unavailable"})
		return
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := discordHTTP.Do(req)
	if err != nil {
		log.Print("[ERROR] Discord sign-in: token exchange network, TLS, or timeout failure")
		c.JSON(http.StatusBadGateway, gin.H{"error": "discord_unavailable"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var failure struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&failure)
		// Log only known provider error codes, never descriptions or raw bodies.
		providerCode := "unrecognized_error"
		switch failure.Error {
		case "invalid_client", "invalid_grant", "invalid_request", "unauthorized_client", "unsupported_grant_type", "invalid_scope":
			providerCode = failure.Error
		}
		log.Printf("[ERROR] Discord sign-in: token exchange HTTP %d (%s)", resp.StatusCode, providerCode)
		status := http.StatusBadGateway
		if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnauthorized {
			status = http.StatusUnauthorized
		}
		c.JSON(status, gin.H{"error": "token_exchange_failed"})
		return
	}
	var tokenResponse struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&tokenResponse); err != nil || tokenResponse.AccessToken == "" || tokenResponse.ExpiresIn <= 0 {
		log.Print("[ERROR] Discord sign-in: invalid token response")
		c.JSON(http.StatusBadGateway, gin.H{"error": "invalid_token_response"})
		return
	}
	var user discordUser
	if err := discordGet(c.Request.Context(), tokenResponse.AccessToken, "/users/@me", &user); err != nil || user.ID == "" || user.Username == "" {
		log.Print("[ERROR] Discord sign-in: could not retrieve Discord user")
		c.JSON(http.StatusBadGateway, gin.H{"error": "discord_user_unavailable"})
		return
	}
	inGuild, err := discordMembership(c.Request.Context(), tokenResponse.AccessToken)
	if err != nil {
		log.Print("[ERROR] Discord sign-in: Discord membership check failed")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "membership_check_unavailable"})
		return
	}
	ttl := 24 * time.Hour
	if tokenResponse.ExpiresIn < int64(ttl.Seconds()) {
		ttl = time.Duration(tokenResponse.ExpiresIn) * time.Second
	}
	sessionID := rand.Text()
	if err := saveDiscordSession(c.Request.Context(), sessionID, discordSession{AccessToken: tokenResponse.AccessToken, User: user}, ttl); err != nil {
		log.Print("[ERROR] Discord sign-in: could not save Redis session")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session_unavailable"})
		return
	}
	claims := jwt.RegisteredClaims{
		Subject: user.ID, ID: sessionID,
		IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session_unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "in_guild": inGuild, "expires_in": int64(ttl.Seconds())})
}
