package routes

import (
	"backend/utils"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

const discordAPI = "https://discord.com/api/v10"
const discordInvite = "https://links.mountaineercraft.net/discord"

var discordHTTP = &http.Client{Timeout: 10 * time.Second}
var errDiscordUnauthorized = errors.New("discord authorization expired")
var errSessionMissing = errors.New("session missing")

type discordUser struct {
	ID       string  `json:"id"`
	Username string  `json:"username"`
	Avatar   *string `json:"avatar"`
	Email    *string `json:"email"`
}

type discordSession struct {
	AccessToken string      `json:"access_token"`
	User        discordUser `json:"user"`
}

// Discord credentials stay in Redis, never in browser-visible JWT claims.
var saveDiscordSession = func(ctx context.Context, id string, session discordSession, ttl time.Duration) error {
	if utils.Rdb == nil {
		return errors.New("redis unavailable")
	}
	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	return utils.Rdb.Set(ctx, "discord:session:"+id, data, ttl).Err()
}

var loadDiscordSession = func(ctx context.Context, id string) (discordSession, error) {
	var session discordSession
	if utils.Rdb == nil {
		return session, errors.New("redis unavailable")
	}
	data, err := utils.Rdb.Get(ctx, "discord:session:"+id).Bytes()
	if errors.Is(err, redis.Nil) {
		return session, errSessionMissing
	}
	if err != nil {
		return session, err
	}
	err = json.Unmarshal(data, &session)
	return session, err
}

var deleteDiscordSession = func(ctx context.Context, id string) error {
	if utils.Rdb == nil {
		return errors.New("redis unavailable")
	}
	return utils.Rdb.Del(ctx, "discord:session:"+id).Err()
}

func discordGet(ctx context.Context, accessToken, endpoint string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discordAPI+endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := discordHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return errDiscordUnauthorized
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("discord returned status %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(target)
}

func discordMembership(ctx context.Context, accessToken string) (bool, error) {
	requiredGuild := os.Getenv("DISCORD_REQUIRED_GUILD_ID")
	if requiredGuild == "" {
		return false, errors.New("required guild is not configured")
	}
	// Discord returns up to 200 guilds, the maximum for a non-bot user.
	var guilds []struct {
		ID string `json:"id"`
	}
	if err := discordGet(ctx, accessToken, "/users/@me/guilds?limit=200", &guilds); err != nil {
		return false, err
	}
	if guilds == nil {
		return false, errors.New("invalid guild response")
	}
	for _, guild := range guilds {
		if guild.ID == requiredGuild {
			return true, nil
		}
	}
	return false, nil
}
