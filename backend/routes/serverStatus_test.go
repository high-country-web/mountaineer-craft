package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestPlanStatusCookieLoginCacheAndExpiry(t *testing.T) {
	logins, reads := 0, 0
	expired := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/login" {
			logins++
			if r.Method != "POST" {
				t.Error("login must use POST")
			}
			r.ParseForm()
			if r.Form.Get("user") != "apiuser" || r.Form.Get("password") != "secret&value" {
				t.Error("incorrect form encoding")
			}
			http.SetCookie(w, &http.Cookie{Name: "auth", Value: "session", Path: "/"})
			expired = false
			fmt.Fprint(w, `{"success":true}`)
			return
		}
		reads++
		if r.URL.Path != "/v1/datapoint" || r.URL.Query().Get("type") != "PLAYERS_ONLINE" || r.URL.Query().Get("server") != "survival" {
			t.Error("wrong aggregate endpoint")
		}
		if cookie, err := r.Cookie("auth"); err != nil || cookie.Value != "session" || expired {
			http.Redirect(w, r, "/login", 302)
			return
		}
		fmt.Fprint(w, "7")
	}))
	defer upstream.Close()
	p := newPlanStatusClient(upstream.URL, "apiuser", "secret&value", "survival")
	for range 2 {
		result, err := p.status(context.Background())
		if err != nil || result.PlayersOnline != 7 || result.UpdatedAt.IsZero() {
			t.Fatalf("unexpected status: %+v %v", result, err)
		}
	}
	if logins != 1 || reads != 2 {
		t.Fatalf("cache/login not reused: %d logins, %d reads", logins, reads)
	}
	p.cacheUntil = time.Time{}
	expired = true
	if _, err := p.status(context.Background()); err != nil || logins != 2 {
		t.Fatalf("session was not renewed: %v", err)
	}
}

func TestPlanStatusRejectsInvalidResponsesAndBacksOff(t *testing.T) {
	for _, body := range []string{"null", "-1", "{}", "1.5", "<html>login</html>", "1 2"} {
		t.Run(body, func(t *testing.T) {
			reads := 0
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { reads++; fmt.Fprint(w, body) }))
			defer upstream.Close()
			p := newPlanStatusClient(upstream.URL, "apiuser", "secret", "")
			for range 2 {
				if _, err := p.status(context.Background()); err == nil {
					t.Fatal("accepted invalid count")
				}
			}
			if reads != 1 {
				t.Fatal("failure was not cached")
			}
		})
	}
}

func TestPlanStatusZeroIsValidAndMissingPasswordMakesNoRequests(t *testing.T) {
	reads := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { reads++; fmt.Fprint(w, "0") }))
	defer upstream.Close()
	p := newPlanStatusClient(upstream.URL, "apiuser", "", "")
	if _, err := p.status(context.Background()); err == nil || reads != 0 {
		t.Fatal("unconfigured Plan should not be contacted")
	}
	p = newPlanStatusClient(upstream.URL, "apiuser", "secret", "")
	result, err := p.status(context.Background())
	if err != nil || result.PlayersOnline != 0 {
		t.Fatalf("zero rejected: %v", err)
	}
}

func TestPlanStatusFailedLoginIsNotRetriedOnEveryRequest(t *testing.T) {
	logins := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/login" {
			logins++
			w.WriteHeader(403)
			fmt.Fprint(w, "private upstream details")
			return
		}
		http.Redirect(w, r, "/login", 302)
	}))
	defer upstream.Close()
	p := newPlanStatusClient(upstream.URL, "apiuser", "secret", "")
	for range 3 {
		if _, err := p.status(context.Background()); err == nil || strings.Contains(err.Error(), "private") {
			t.Fatal("login failure not handled safely")
		}
	}
	if logins != 1 {
		t.Fatalf("expected login backoff, got %d attempts", logins)
	}
}

func TestPublicStatusDoesNotExposeUpstreamErrors(t *testing.T) {
	t.Setenv("PLAN_API_PASSWORD", "")
	r := gin.New()
	r.GET("/status", serverStatusRoute())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/status", nil))
	if w.Code != 503 || strings.Contains(w.Body.String(), "configured") || w.Body.String() != `{"error":"server_status_unavailable"}` {
		t.Fatalf("unexpected response: %d %s", w.Code, w.Body)
	}
}
