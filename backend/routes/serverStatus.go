package routes

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Only this aggregate is public. Plan cookies and player records stay on the API.
type serverStatus struct {
	PlayersOnline int       `json:"players_online"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type planStatusClient struct {
	mu                                  sync.Mutex
	client                              *http.Client
	baseURL, username, password, server string
	cached                              serverStatus
	cacheUntil                          time.Time
	lastErr                             error
}

func newPlanStatusClient(baseURL, username, password, server string) *planStatusClient {
	jar, _ := cookiejar.New(nil)
	return &planStatusClient{baseURL: strings.TrimRight(baseURL, "/"), username: username, password: password, server: server,
		client: &http.Client{Jar: jar, Timeout: 5 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (p *planStatusClient) login(ctx context.Context) error {
	form := url.Values{"user": {p.username}, "password": {p.password}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/auth/login", strings.NewReader(form.Encode()))
	if err != nil {
		return errors.New("invalid analytics configuration")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := p.client.Do(req)
	if err != nil {
		return errors.New("analytics login unavailable")
	}
	defer resp.Body.Close()
	var result struct {
		Success bool `json:"success"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&result) != nil || !result.Success {
		return errors.New("analytics login failed")
	}
	return nil
}

func (p *planStatusClient) count(ctx context.Context) (int, bool, error) {
	query := url.Values{"type": {"PLAYERS_ONLINE"}}
	if p.server != "" {
		query.Set("server", p.server)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/v1/datapoint?"+query.Encode(), nil)
	if err != nil {
		return 0, false, errors.New("invalid analytics configuration")
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return 0, false, errors.New("analytics unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode == 302 || resp.StatusCode == 401 || resp.StatusCode == 403 {
		return 0, true, errors.New("analytics authentication required")
	}
	var count *int
	decoder := json.NewDecoder(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != http.StatusOK || decoder.Decode(&count) != nil || count == nil || *count < 0 {
		return 0, false, errors.New("invalid analytics response")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return 0, false, errors.New("invalid analytics response")
	}
	return *count, false, nil
}

func (p *planStatusClient) status(ctx context.Context) (serverStatus, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if time.Now().Before(p.cacheUntil) {
		return p.cached, p.lastErr
	}
	var err error
	var count int
	if p.password == "" {
		err = errors.New("analytics is not configured")
	} else {
		var needsLogin bool
		count, needsLogin, err = p.count(ctx)
		if needsLogin {
			err = p.login(ctx)
			if err == nil {
				count, _, err = p.count(ctx)
			}
		}
	}
	p.lastErr = err
	if err != nil {
		// Back off on failures too, including invalid credentials.
		p.cacheUntil = time.Now().Add(30 * time.Second)
		return serverStatus{}, err
	}
	p.cached = serverStatus{PlayersOnline: count, UpdatedAt: time.Now().UTC()}
	p.cacheUntil = time.Now().Add(15 * time.Second)
	return p.cached, nil
}

func serverStatusRoute() gin.HandlerFunc {
	baseURL := os.Getenv("PLAN_API_URL")
	if baseURL == "" {
		baseURL = "https://analytics.mountaineercraft.net"
	}
	username := os.Getenv("PLAN_API_USERNAME")
	if username == "" {
		username = "apiuser"
	}
	p := newPlanStatusClient(baseURL, username, os.Getenv("PLAN_API_PASSWORD"), os.Getenv("PLAN_SERVER_ID"))
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		ctx, cancel := context.WithTimeout(c.Request.Context(), 12*time.Second)
		defer cancel()
		status, err := p.status(ctx)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "server_status_unavailable"})
			return
		}
		c.JSON(http.StatusOK, status)
	}
}
