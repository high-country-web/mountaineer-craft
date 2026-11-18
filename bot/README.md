# Mountaineer Helper

Copy `example.env` to `.env`, configure the Discord and Plan credentials, and install
the dependencies in this directory. `PLAYER_ANALYTICS_URL` must be the Plan origin
(for example, `https://analytics.mountaineercraft.net`), not its login or player page.

```sh
npm install
npm run build
npm start
```

## Plan connection recovery

The Plan client logs in using a POST form and keeps its `auth` cookie in memory.
API requests do not follow redirects: a redirect, HTTP 401/403, or a successful
non-JSON page triggers one fresh login and one retry. Concurrent requests share
the same login attempt. Requests time out after ten seconds. Persistent failures
produce a concise error without logging credentials, cookies, or response bodies.
The Plan account must have permission to access `/v1/playersOnline` and `/v1/player`.

The `playersOnline` job normally runs every minute. After a failure, attempts back
off for 1, 2, 4, 8, and then 10 minutes, capped at ten minutes. The scheduler skips
attempts during the cooldown and prevents overlapping runs. A successful sync
resets the delay and logs recovery. Failed or malformed Plan responses do not
change Discord roles. A valid empty player list clears stale online roles.

Deploy the updated bot and restart it once to load these changes. Later expired
Plan sessions recover automatically; a normal session expiry no longer needs a
bot restart. Persistent HTML responses after re-login usually require checking
the configured Plan URL, reverse proxy, or API-account permissions.
