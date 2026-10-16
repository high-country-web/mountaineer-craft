package routes

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func setupAuth(t *testing.T) (*gin.Engine, string, map[string]discordSession) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "test-secret-never-used-in-production")
	t.Setenv("DISCORD_REQUIRED_GUILD_ID", "required-guild")
	t.Setenv("DISCORD_CLIENT_ID", "test-client")
	t.Setenv("DISCORD_CLIENT_SECRET", "test-client-secret")
	t.Setenv("DISCORD_REDIRECT_URI", "http://localhost/oauth/discord")
	oldSave, oldLoad, oldDelete, oldHTTP := saveDiscordSession, loadDiscordSession, deleteDiscordSession, discordHTTP
	t.Cleanup(func() {
		saveDiscordSession, loadDiscordSession, deleteDiscordSession, discordHTTP = oldSave, oldLoad, oldDelete, oldHTTP
	})
	email, avatar := "player@example.com", "avatar-hash"
	sessions := map[string]discordSession{"test-session": {AccessToken: "private-discord-token", User: discordUser{ID: "player-id", Username: "test_player", Email: &email, Avatar: &avatar}}}
	saveDiscordSession = func(_ context.Context, id string, session discordSession, ttl time.Duration) error {
		if ttl <= 0 || ttl > 24*time.Hour {
			t.Fatalf("invalid TTL %v", ttl)
		}
		sessions[id] = session
		return nil
	}
	loadDiscordSession = func(_ context.Context, id string) (discordSession, error) {
		session, ok := sessions[id]
		if !ok {
			return session, errSessionMissing
		}
		return session, nil
	}
	deleteDiscordSession = func(_ context.Context, id string) error { delete(sessions, id); return nil }
	mockDiscord(http.StatusOK, `[{"id":"required-guild"}]`)
	router := gin.New()
	meRoute(router.Group("/me"))
	router.POST("/auth/discord", authRoute)
	router.POST("/auth/logout", RequireSession(), logoutRoute)
	token := testJWT(t, jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "player-id", ID: "test-session", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))})
	return router, token, sessions
}

func testJWT(t *testing.T, method jwt.SigningMethod, claims jwt.Claims) string {
	t.Helper()
	token, err := jwt.NewWithClaims(method, claims).SignedString([]byte("test-secret-never-used-in-production"))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func mockDiscord(status int, guilds string) {
	discordHTTP = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, code := guilds, status
		if strings.HasSuffix(req.URL.Path, "/oauth2/token") {
			body, code = `{"access_token":"private-discord-token","expires_in":3600}`, 200
		}
		if strings.HasSuffix(req.URL.Path, "/users/@me") {
			body, code = `{"id":"player-id","username":"test_player","email":"player@example.com","avatar":"avatar-hash"}`, 200
		}
		return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
}

func requestAuth(router http.Handler, method, path, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func TestMeRequiresLiveMembership(t *testing.T) {
	router, token, _ := setupAuth(t)
	member := requestAuth(router, "GET", "/me", token, "")
	if member.Code != 200 || !strings.Contains(member.Body.String(), `"in_guild":true`) || !strings.Contains(member.Body.String(), `"avatar":"avatar-hash"`) {
		t.Fatalf("member: %d %s", member.Code, member.Body)
	}
	// Leaving the guild revokes access even though the JWT is still valid.
	mockDiscord(200, `[]`)
	nonmember := requestAuth(router, "GET", "/me", token, "")
	if nonmember.Code != 403 || strings.Contains(nonmember.Body.String(), "test_player") || strings.Contains(nonmember.Body.String(), "player@example.com") {
		t.Fatalf("nonmember leaked profile: %d %s", nonmember.Code, nonmember.Body)
	}
	// Joining again unlocks the same session, without another OAuth exchange.
	mockDiscord(200, `[{"id":"required-guild"}]`)
	if result := requestAuth(router, "GET", "/me", token, ""); result.Code != 200 {
		t.Fatalf("joined: %d %s", result.Code, result.Body)
	}
}

func TestMembershipFailuresFailClosed(t *testing.T) {
	for _, tc := range []struct {
		name          string
		discordStatus int
		guilds        string
		want          int
	}{
		{"unrelated guild", 200, `[{"id":"other-guild"}]`, 403},
		{"rate limited", 429, `{}`, 503},
		{"discord outage", 500, `{}`, 503},
		{"revoked Discord grant", 401, `{}`, 401},
		{"invalid response", 200, `{}`, 503},
		{"null response", 200, `null`, 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router, token, _ := setupAuth(t)
			mockDiscord(tc.discordStatus, tc.guilds)
			result := requestAuth(router, "GET", "/me", token, "")
			if result.Code != tc.want || strings.Contains(result.Body.String(), "test_player") {
				t.Fatalf("got %d %s", result.Code, result.Body)
			}
		})
	}
}

func TestMeRejectsInvalidSessions(t *testing.T) {
	for _, tc := range []struct {
		name   string
		method jwt.SigningMethod
		claims jwt.RegisteredClaims
	}{
		{"expired", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "player-id", ID: "test-session", ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour))}},
		{"missing expiry", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "player-id", ID: "test-session"}},
		{"wrong algorithm", jwt.SigningMethodHS512, jwt.RegisteredClaims{Subject: "player-id", ID: "test-session", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}},
		{"legacy token", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "player-id", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}},
		{"unknown session", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "player-id", ID: "missing", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}},
		{"wrong subject", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "someone-else", ID: "test-session", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router, _, _ := setupAuth(t)
			result := requestAuth(router, "GET", "/me", testJWT(t, tc.method, tc.claims), "")
			if result.Code != 401 {
				t.Fatalf("got %d %s", result.Code, result.Body)
			}
		})
	}
}

func TestMissingConfigurationAndStorageDenyAccess(t *testing.T) {
	router, token, _ := setupAuth(t)
	if got := requestAuth(router, "GET", "/me", "", ""); got.Code != 401 {
		t.Fatalf("missing JWT: %d", got.Code)
	}
	t.Setenv("DISCORD_REQUIRED_GUILD_ID", "")
	if got := requestAuth(router, "GET", "/me", token, ""); got.Code != 503 {
		t.Fatalf("missing guild: %d", got.Code)
	}
	t.Setenv("DISCORD_REQUIRED_GUILD_ID", "required-guild")
	loadDiscordSession = func(context.Context, string) (discordSession, error) {
		return discordSession{}, errors.New("redis offline")
	}
	if got := requestAuth(router, "GET", "/me", token, ""); got.Code != 503 {
		t.Fatalf("redis outage: %d", got.Code)
	}
	t.Setenv("JWT_SECRET", "")
	if got := requestAuth(router, "GET", "/me", token, ""); got.Code != 503 {
		t.Fatalf("missing secret: %d", got.Code)
	}
}

func TestOAuthCreatesSessionWithoutExposingCredentials(t *testing.T) {
	for _, member := range []bool{true, false} {
		t.Run(map[bool]string{true: "member", false: "nonmember"}[member], func(t *testing.T) {
			router, _, _ := setupAuth(t)
			if !member {
				mockDiscord(200, `[]`)
			}
			result := requestAuth(router, "POST", "/auth/discord", "", `{"code":"one-use-code"}`)
			if result.Code != 200 {
				t.Fatalf("oauth: %d %s", result.Code, result.Body)
			}
			var response struct {
				Token     string `json:"token"`
				InGuild   bool   `json:"in_guild"`
				ExpiresIn int    `json:"expires_in"`
			}
			if err := json.Unmarshal(result.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response.InGuild != member || response.ExpiresIn != 3600 {
				t.Fatalf("wrong session result: %+v", response)
			}
			if strings.Contains(result.Body.String(), "private-discord-token") || strings.Contains(result.Body.String(), "player@example.com") {
				t.Fatal("OAuth leaked credentials or profile before membership gate")
			}
			claims := jwt.MapClaims{}
			if _, _, err := jwt.NewParser().ParseUnverified(response.Token, claims); err != nil {
				t.Fatal(err)
			}
			if len(claims) != 4 || claims["sub"] != "player-id" {
				t.Fatalf("unexpected browser-visible claims: %v", claims)
			}
			want := 403
			if member {
				want = 200
			}
			if got := requestAuth(router, "GET", "/me", response.Token, ""); got.Code != want {
				t.Fatalf("profile: %d %s", got.Code, got.Body)
			}
		})
	}
}

func TestLogoutRevokesSession(t *testing.T) {
	router, token, _ := setupAuth(t)
	// Non-members must still be able to sign out.
	mockDiscord(200, `[]`)
	if got := requestAuth(router, "POST", "/auth/logout", token, ""); got.Code != 204 {
		t.Fatalf("logout: %d %s", got.Code, got.Body)
	}
	if got := requestAuth(router, "GET", "/me", token, ""); got.Code != 401 {
		t.Fatalf("revoked session: %d", got.Code)
	}
}
