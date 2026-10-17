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

A count of zero means no players online; it does not establish that the Minecraft server is offline. This display reports player activity, not a separate Minecraft reachability probe. `/v1/playersTable` contains historical players and must not be used as an online player count.

## Discord account links

Plan's DiscordSRV extension can report a linked-account boolean and Discord username for a Minecraft UUID through player extension data. Its default fields do not expose the immutable Discord user ID. Securely associating a signed-in website user with a Minecraft account needs an authoritative Discord ID to Minecraft UUID mapping from DiscordSRV or another trusted integration. Do not match mutable usernames or use analytics as proof of current Discord server membership. Player profiles and account links are not exposed by the public status route.
