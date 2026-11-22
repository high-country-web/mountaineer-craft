package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Only these aggregate metrics may leave the API. Never forward raw Panel data.
type serverStats struct {
	State     string    `json:"state"`
	Uptime    *int64    `json:"uptime_ms"`
	Memory    *int64    `json:"memory_bytes"`
	CPU       *float64  `json:"cpu_percent"`
	Disk      *int64    `json:"disk_bytes"`
	Received  *int64    `json:"network_rx_bytes"`
	Sent      *int64    `json:"network_tx_bytes"`
	UpdatedAt time.Time `json:"updated_at"`
}

type panelStatsClient struct {
	mu            sync.Mutex
	endpoint, key string
	client        *http.Client
	cached        serverStats
	until         time.Time
	err           error
	configErr     error
}

func newPanelStatsClient() *panelStatsClient {
	key := strings.TrimSpace(os.Getenv("PTERODACTYL_CLIENT_API_KEY"))
	endpoint, err := pterodactylServerEndpoint(strings.TrimSpace(os.Getenv("PTERODACTYL_PANEL_URL")), strings.TrimSpace(os.Getenv("PTERODACTYL_MINECRAFT_SERVER_ID")), key)
	return &panelStatsClient{endpoint: endpoint + "/resources", key: key, configErr: err,
		client: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
}

func decodeServerStats(reader io.Reader) (serverStats, error) {
	var payload struct {
		Object     string `json:"object"`
		Attributes struct {
			State     string `json:"current_state"`
			Suspended bool   `json:"is_suspended"`
			Resources *struct {
				Uptime   *int64   `json:"uptime"`
				Memory   *int64   `json:"memory_bytes"`
				CPU      *float64 `json:"cpu_absolute"`
				Disk     *int64   `json:"disk_bytes"`
				Received *int64   `json:"network_rx_bytes"`
				Sent     *int64   `json:"network_tx_bytes"`
			} `json:"resources"`
		} `json:"attributes"`
	}
	decoder := json.NewDecoder(io.LimitReader(reader, 64<<10))
	if err := decoder.Decode(&payload); err != nil {
		return serverStats{}, errors.New("invalid resource response")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF || payload.Object != "stats" || payload.Attributes.Resources == nil {
		return serverStats{}, errors.New("invalid resource response")
	}
	state := payload.Attributes.State
	switch state {
	case "running", "offline", "starting", "stopping":
	default:
		return serverStats{}, errors.New("invalid server state")
	}
	if payload.Attributes.Suspended {
		state = "suspended"
	}
	r := payload.Attributes.Resources
	for _, metric := range []*int64{r.Uptime, r.Memory, r.Disk, r.Received, r.Sent} {
		if metric != nil && (*metric < 0 || *metric > 9007199254740991) {
			return serverStats{}, errors.New("invalid resource metric")
		}
	}
	if r.CPU != nil && (*r.CPU < 0 || math.IsNaN(*r.CPU) || math.IsInf(*r.CPU, 0)) {
		return serverStats{}, errors.New("invalid CPU metric")
	}
	return serverStats{State: state, Uptime: r.Uptime, Memory: r.Memory, CPU: r.CPU, Disk: r.Disk, Received: r.Received, Sent: r.Sent, UpdatedAt: time.Now().UTC()}, nil
}

func (p *panelStatsClient) fetch(ctx context.Context) (serverStats, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if time.Now().Before(p.until) {
		return p.cached, p.err
	}
	if p.configErr != nil {
		return serverStats{}, p.configErr
	}
	stats, err := p.request(ctx)
	if err != nil {
		// Failures back off too; never present old readings as live or as zeroes.
		p.err = err
		p.until = time.Now().Add(30 * time.Second)
		log.Printf("[ERROR] GET /stats: %v", err)
		return serverStats{}, err
	}
	p.cached, p.err, p.until = stats, nil, time.Now().Add(15*time.Second)
	return stats, nil
}

func (p *panelStatsClient) request(ctx context.Context) (serverStats, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.endpoint, nil)
	if err != nil {
		return serverStats{}, errors.New("invalid Panel resource request")
	}
	req.Header.Set("Authorization", "Bearer "+p.key)
	req.Header.Set("Accept", "application/vnd.pterodactyl.v1+json")
	response, err := p.client.Do(req)
	if err != nil {
		return serverStats{}, errors.New("Panel resource request failed: network, TLS, or timeout")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return serverStats{}, fmt.Errorf("Panel resources returned HTTP %d", response.StatusCode)
	}
	return decodeServerStats(response.Body)
}

func serverStatsRoute() gin.HandlerFunc {
	client := newPanelStatsClient()
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		stats, err := client.fetch(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "server_stats_unavailable"})
			return
		}
		c.JSON(http.StatusOK, stats)
	}
}
