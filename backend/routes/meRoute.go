package routes

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// RequireSession authenticates a JWT and its corresponding unexpired Redis session.
func RequireSession() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "auth_not_configured"})
			return
		}
		header := strings.Fields(c.GetHeader("Authorization"))
		if len(header) != 2 || !strings.EqualFold(header[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
			return
		}
		claims := &jwt.RegisteredClaims{}
		token, err := jwt.ParseWithClaims(header[1], claims, func(t *jwt.Token) (any, error) { return []byte(secret), nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
		if err != nil || !token.Valid || claims.ID == "" || claims.Subject == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_session"})
			return
		}
		session, err := loadDiscordSession(c.Request.Context(), claims.ID)
		if errors.Is(err, errSessionMissing) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session_expired"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "session_unavailable"})
			return
		}
		if session.AccessToken == "" || session.User.ID != claims.Subject {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_session"})
			return
		}
		c.Set("discord_session", session)
		c.Set("session_id", claims.ID)
		c.Next()
	}
}

// RequireDiscordMember must guard every API group that exposes member-only data.
func RequireDiscordMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		session, ok := c.MustGet("discord_session").(discordSession)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_session"})
			return
		}
		inGuild, err := discordMembership(c.Request.Context(), session.AccessToken)
		if errors.Is(err, errDiscordUnauthorized) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "discord_session_expired"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "membership_check_unavailable"})
			return
		}
		if !inGuild {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "discord_membership_required", "in_guild": false, "join_url": discordInvite})
			return
		}
		c.Next()
	}
}

func meRoute(me *gin.RouterGroup) {
	me.Use(RequireSession(), RequireDiscordMember())
	me.GET("", func(c *gin.Context) {
		session := c.MustGet("discord_session").(discordSession)
		c.JSON(http.StatusOK, gin.H{"id": session.User.ID, "username": session.User.Username, "email": session.User.Email, "avatar": session.User.Avatar, "in_guild": true})
	})
}

func logoutRoute(c *gin.Context) {
	if err := deleteDiscordSession(c.Request.Context(), c.GetString("session_id")); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session_unavailable"})
		return
	}
	c.Status(http.StatusNoContent)
}
