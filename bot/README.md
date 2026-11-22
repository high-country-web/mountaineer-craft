# Mountaineer Helper

Copy `example.env` to `.env`, configure the Discord and Plan credentials, and install
the dependencies in this directory. `PLAYER_ANALYTICS_URL` must be the Plan origin
(for example, `https://analytics.mountaineercraft.net`), not its login or player page.

```sh
npm install
npm run build
npm start
```

## Plugin update checks

The new `data/plugins.json` tracks the 23 plugins from the current server list.
It supports GitHub stable releases, Modrinth releases, Spigot version metadata
through Spiget, and explicit manual entries. No plugin files are downloaded or
installed. Back, Offlinetp and LogCleaner need author/download-page confirmation;
Geyser and Floodgate use manual entries because their development-build identity
cannot be inferred from a generic SNAPSHOT version.

Run `/plugin-updates` with Discord **Manage Server** permission to post public
embeds in the current channel. The entire report is shown in embeds, including
installed/latest versions, release links, and results needing review. No text
attachment is created. Longer reports use multiple embeds.
Missing installed versions, unknown version
formats, source failures, and manual entries are shown separately. The checker
does not declare unfamiliar version strings outdated using loose coercion.
GitHub prereleases/drafts and Modrinth beta/alpha releases are excluded. The
Spigot source reports the version published on Spigot; compatibility/release
channel must be reviewed on its page.

Set `minecraftVersion` in `data/plugins.json` to your exact Minecraft version to
filter Modrinth releases. It starts null because the plugin list did not include
this information. GitHub and Spigot source checks do not establish Minecraft
compatibility; review release notes before updating. `stripSuffixes` is an
explicit list for platform suffixes such as LuckPerms' `-bukkit`.

Set a plugin's `installedVersion` to pin its known installed version, or leave it
null and set the bot's three `PTERODACTYL_*` variables to read startup version
announcements from `/logs/latest.log`. These settings must be present on the bot
as well as the backend. Panel file-read-content permission is required. Logs over
4 MiB or unavailable startup lines leave versions unknown; no version is guessed
from a jar filename. Pinned versions take priority and must be maintained after
manual updates. Aliases cover alternate names used in startup logs.

`GITHUB_TOKEN` is optional; supplying one raises the public GitHub API rate limit.
Only GitHub requests receive it. Results are cached for five minutes, concurrent
checks share work, identical sources are requested once per scan, and at most
three checks run in parallel. Provider timeouts/errors do not prevent the other
plugins from being checked.

Set `PLUGIN_UPDATES_CHANNEL_ID` to enable hourly alerts, including a startup
check. Otherwise only the manual command runs. The bot must be able to view and
send messages/attachments in that channel in the configured guild. Alerts only
show confirmed newer versions in embeds and persist sent installed/latest pairs in
`PLUGIN_UPDATES_STATE_FILE` (default `data/plugin-update-state.json`). Preserve
that file across restarts; the Coolify stack mounts `/app/state` for this purpose.
No live notification was sent during implementation.

For container deployment and the shared Panel variables, see
[the Coolify guide](../deploy/COOLIFY.md).

## Website profile command

`/link` privately sends a button to the member's website profile. Users sign in
with the same Discord account used to verify Minecraft access. The website reads
their existing DiscordSRV ID-to-UUID mapping, so no new code or username lookup
is needed. Unlinked users are directed to complete the usual Minecraft code
verification first. The command does not change DiscordSRV's links.

Configure `DISCORDSRV_ACCOUNTS_FILE` on the Go backend as described in
[backend configuration](../backend/readme.md#discord-account-links), and deploy
the backend and frontend with the bot. Restart the bot after building to register
the new guild slash command.

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
