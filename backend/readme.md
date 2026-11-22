# Backend configuration

Copy `example.env` to `.env` and configure the existing Redis and Discord settings.

## Public server activity

`GET /status` returns only `players_online` (an integer) and `updated_at` (UTC ISO timestamp). The homepage calls this through the public Next.js `/api/server/status` route. No login or Discord membership is required to view it.

Configure these variables on the Go server:

```dotenv
PLAN_API_URL=https://analytics.mountaineercraft.net
PLAN_API_USERNAME=apiuser
PLAN_API_PASSWORD=your-password
PLAN_SERVER_ID=
```

Keep the password on the Go server. Do not use a `NEXT_PUBLIC_` variable. The Plan account needs access to `/v1/datapoint?type=PLAYERS_ONLINE`. `PLAN_SERVER_ID` optionally selects one server; leave empty for Plan's default scope (which may be the whole network).

Plan uses form login at `POST /auth/login` with `user` and `password`, followed by the returned `auth` cookie. The backend keeps that cookie in memory, renews it once on authentication failure, caches counts for 15 seconds, and backs off for 30 seconds after a failure. The browser refreshes every 30 seconds. Missing credentials or invalid/unavailable upstream data return a generic HTTP 503 without publishing Plan's response.

Plan's `/v1/datapoint` returns an object such as `{"type":"PLAYERS_ONLINE","value":7,"formatType":"NONE","timestamp":1792195200000}`. The backend validates the metric type and reads the nonnegative integer from `value`; it does not expect a bare JSON number or forward Plan's metadata.

A count of zero means no players online; it does not establish that the Minecraft server is offline. This display reports player activity, not a separate Minecraft reachability probe. `/v1/playersTable` contains historical players and must not be used as an online player count.

Status failures are logged to the Go backend console (stderr) as `[ERROR] GET /status` with the failed operation and reason, including upstream HTTP codes, missing `PLAN_API_PASSWORD`, timeouts, and invalid response formats. Each failed refresh logs once; requests served during the 30-second failure backoff do not repeat the log. Credentials, cookies, upstream bodies, and configured URLs are omitted. The public JSON remains generic. The Next.js server console also logs backend HTTP failures, invalid payloads, and connection failures for `/api/server/status`; a backend HTTP 503 should be investigated in the Go console for the Plan-specific cause.

## Public server resource stats

`GET /stats` returns an allowlisted resource snapshot for the Minecraft server.
The website's public `/stats` page calls it through `/api/server/stats`. It uses
the same `PTERODACTYL_PANEL_URL`, `PTERODACTYL_MINECRAFT_SERVER_ID`, and
`PTERODACTYL_CLIENT_API_KEY` settings as account linking. The Client API user needs
access to this Minecraft server. File-read permission is only needed for account
links, not resource stats. No extra frontend credentials or mounts are required.

The backend calls Pterodactyl's
[`GET /api/client/servers/{server}/resources`](https://docs.pterodactyl.io/v1/api/client-server/get-resource-usage).
Only state, current uptime in milliseconds, memory bytes, CPU percent, disk bytes,
received/sent byte counters, and the retrieval timestamp are published. Raw Panel
responses, credentials, configuration, and server identifiers are not forwarded.
CPU can exceed 100%: 100% represents one core. Missing readings remain null and
display as unavailable; they are not replaced with zeroes. A stopped server is a
successful offline reading, distinct from a Panel connection failure. Uptime is
time since this start, not a historical availability percentage.

Requests share a 15-second backend cache and an 8-second upstream timeout.
Failures back off for 30 seconds and return a generic 503. Error logs contain
sanitized failure reasons and HTTP codes without Panel URLs, keys, or bodies.
The browser refreshes every 30 seconds while visible and retries on tab focus.
Pterodactyl itself may cache readings, so this is periodic monitoring rather than
instantaneous telemetry. On failed refreshes, the page labels its last successful
readings as old and shows a retry notice.

Network totals are cumulative counters. Average transfer rates use changes in
counters divided by reported uptime changes between consecutive running samples;
they remain unavailable before two samples or when counters/uptime reset. Memory
and CPU charts retain at most 30 samples in the open tab, with no persistent
history. Deploy both frontend and backend and restart the backend after setting
the Panel variables. The existing Plan-powered `/status` player count is separate.

## Public player directory

`GET /players` returns `{ "players": [...] }`; `GET /players/:slug` returns one
profile, where the slug is a Minecraft UUID. Both routes are public. They reuse
the `PLAN_API_*` settings above and optional `PLAN_SERVER_ID`. The Plan account
also needs access to `/v1/playersTable` and `/v1/player` (player overview).
The directory expects Plan's structured `players` array (`playerUUID`,
`playerName`, `playtimeActive`, `sessionCount`, `registered`, `lastSeen`).
See [Plan's player DTO](https://github.com/plan-player-analytics/Plan/blob/master/Plan/common/src/main/java/com/djrapitops/plan/delivery/domain/datatransfer/TablePlayerDto.java).

Only names, UUIDs, activity dates, active playtime, session counts, online status,
deaths, and kill counts are published. Connection data, location, extensions,
account links, and Plan cookies are never forwarded. Directory refreshes and
failure retries are limited to once every 30 seconds. Profile requests are limited
to players in the configured directory. Unknown UUIDs return 404 and upstream
failures return a generic 503. Missing metrics remain null rather than fabricated
zeroes. An empty directory is a successful empty array.

Profile death and kill counts accept both Plan's legacy snake_case fields
(`death_count`, `mob_kill_count`, `player_kill_count`) and newer camelCase fields
(`deathCount`, `mobKillCount`, `playerKillCount`) inside `info`. The Plan account
needs player overview permission for these fields; missing or invalid values
remain unavailable.

## Discord account links

The member-only `GET /me/minecraft` endpoint reads the signed-in user's immutable
Discord ID from their authenticated session and looks it up in DiscordSRV's live
`accounts.aof` file, fetched through the Pterodactyl Client API or read locally.
The frontend proxies this through `/api/account/minecraft`
using the HttpOnly session cookie. Discord membership is still checked on every
request. Plan supplies public stats only; usernames are never used to verify links.

### Pterodactyl Client API (no mounts)

Set these in the Go backend's `.env` (never frontend variables):

```dotenv
PTERODACTYL_PANEL_URL=https://panel.example.com
PTERODACTYL_MINECRAFT_SERVER_ID=abcd1234
PTERODACTYL_CLIENT_API_KEY=your-client-api-key
```

Use the short 8-character ID from the Minecraft server's Panel URL:
`https://panel.example.com/server/abcd1234`. Generate a **Client API key** from
Account → API Credentials (`/account/api`), not an Application API key from the
admin area. For limited access, create a dedicated Panel user, add it as a subuser
of the Minecraft server with `file.read-content` permission, and generate the key
while signed in as that user. This permission allows reading server files, not
just `accounts.aof`; Pterodactyl does not scope it to one path.

The backend requests:

```text
GET /api/client/servers/abcd1234/files/contents?file=%2Fplugins%2FDiscordSRV%2Faccounts.aof
Authorization: Bearer <client-api-key>
```

The file path is relative to the Minecraft server's root; do not include
`/home/container`. The backend fetches the current file on each account lookup,
then replays its link/unlink records. There is no background polling or stale
link cache. HTTPS is required, redirects are refused, and requests time out after
five seconds. Permission errors, rate limits, network failures, or invalid file
data return a generic 503; retry with **Check again** after resolving the issue.
No account mappings or Panel credentials are sent to the browser.

Setting any of these three variables selects API mode. Supply all three; partial
configuration fails closed. API mode takes precedence over the local file option.
Restart the backend after configuring it. No Wings changes or mounts are needed.

See [Pterodactyl file contents API](https://docs.pterodactyl.io/v1/api/client-server-file-manager/get-get-file-contents)
and [API authentication](https://docs.pterodactyl.io/v1/api).

### Alternative: local file or read-only mount

Leave all three Panel API settings empty and set this in the Go backend's `.env`:

```dotenv
DISCORDSRV_ACCOUNTS_FILE=/home/container/plugins/DiscordSRV/accounts.aof
```

This path must exist **inside the backend's filesystem**. A path visible in the
Minecraft container is not automatically visible in the API container. If they
run separately, mount the live DiscordSRV directory read-only into the backend
and use its mounted path, for example:

```yaml
volumes:
  - /actual/host/path/to/plugins/DiscordSRV:/mnt/discordsrv:ro
environment:
  DISCORDSRV_ACCOUNTS_FILE: /mnt/discordsrv/accounts.aof
```

Replace the host path with the real directory on the Docker host; the Minecraft
container's `/home/container` path may have a different host location. Mount the
**directory**, since DiscordSRV replaces `accounts.aof` when compacting it. Give
the API process read permission. Do not serve this directory publicly or upload
account mappings to the frontend. If the API runs on another machine, it needs
a live shared mount; copying this file once will leave unlink/relink data stale.
Restart the Go backend after configuring the path.

The reader replays link and removal records on every request, including removals
by Discord ID, UUID, or both. It never modifies DiscordSRV's files and does not
fall back to username guesses or stale mappings when reading fails. Missing,
malformed, conflicting, oversized (over 16 MiB), or incomplete files return a
generic 503. A brief 503 during DiscordSRV compaction can be retried. Empty files
mean no linked accounts. Missing configuration returns `not_configured`.

A verified link returns `{ "status": "linked", "uuid": "...", "player": ... }`.
If Plan is unavailable or has no public record yet, `player` is null and the
verified UUID still appears. An absent mapping returns `not_linked`. Account
links never grant permissions or replace the live Discord membership check.
The old `PLAN_DB_*` username-lookup settings are no longer used.

The bot's `/link` command sends a private button to `https://mountaineercraft.net/me`.
Users sign in with the same Discord account they verified in Minecraft; existing
links appear automatically, with no second verification code. Users without an
existing link follow the server's Minecraft-to-Discord code process first.
Deploy the backend, frontend, and bot together; restart the bot to register `/link`.
