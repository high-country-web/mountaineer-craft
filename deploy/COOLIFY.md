# Bot and backend on Coolify

GitHub Actions builds the bot and Go backend, pushes both to GHCR, and then
requests one Coolify deployment, following the Yosef production workflow pattern.
Coolify runs the prebuilt images and Redis from `compose.production.yaml`.
The frontend keeps its existing deployment.

## 1. Publish the images

Commit the Dockerfiles, bot lockfile, workflow, Compose file, and source changes.
Push to `main`, or manually run **Production images** on `main` in GitHub Actions.
The workflow builds both services on pull requests without pushing or deploying.
Main builds publish:

| Service | Image                                                       |
| ------- | ----------------------------------------------------------- |
| Bot     | `ghcr.io/high-country-web/mountaineer-craft-bot:latest`     |
| Backend | `ghcr.io/high-country-web/mountaineer-craft-backend:latest` |

Each also gets `:sha-<full-commit>` and its immutable digest appears in the Actions
summary. Builds target Linux amd64. Both images must finish successfully before
the deployment webhook runs. No production credentials are needed for image
builds; the workflow uses GitHub's built-in `GITHUB_TOKEN` to publish packages.

If GHCR rejects publishing, enable package creation for this organization/repo.
For private images, configure registry authentication on the Coolify deployment
server with a GitHub identity/token authorized to read both packages. Public
packages can be pulled without credentials. Never bake registry tokens into images.

## 2. Create one Coolify Compose resource

Create a Docker Compose resource from this repository with
`compose.production.yaml` as the Compose file. It uses prebuilt `image:` entries,
not `build:` contexts. It may also be used as a custom Compose service by copying
the file into Coolify. Keep that copy synchronized if you choose this option.

Paste the variables from `coolify.env.example` into this resource and replace all
placeholders. Values are runtime settings, not Docker build arguments.

- Use the existing Discord bot/OAuth application credentials and guild ID.
- The Plan user must allow `/v1/player`, `/v1/playersTable`,
  `/v1/playersOnline`, and the players-online datapoint.
- The three Panel settings enable account linking, resource stats, and startup
  plugin-version detection. The Client API user needs access to the Minecraft
  server and file-read-content permission. Use its short eight-character server ID.
- The Compose stack maps `PLAN_API_*` to the bot's `PLAYER_ANALYTICS_*` settings.
  The bot and API therefore use the same Plan account.
- `PLUGIN_UPDATES_CHANNEL_ID` enables hourly plugin alerts. Leave it blank for
  manual checks only. `GITHUB_TOKEN` is optional for the bot's release checks and
  is separate from the GitHub Actions token.

The Compose file publishes the backend on **127.0.0.1:8080** for the existing
Caddy running directly on the same Docker host. Keep its upstream set to
`reverse_proxy 127.0.0.1:8080`, and leave the backend's **Coolify domain empty** so
Caddy handles HTTPS. Ensure host port 8080 is free before deploying. This mapping
is loopback-only; it does not publish the API port on the public interface.

If using Coolify's integrated proxy instead, remove this host port mapping and
configure a domain on **backend** targeting container port **4002**, such as
`https://api.mountaineercraft.net:4002` in Coolify's domain field. Use one routing
setup for the domain. The bot is a background worker; give it no domain or HTTP
health check. Redis stays internal and has no published host port.

The backend image includes `GET /health`, which checks Redis. Redis has its own
health check, and backend startup waits for it. Named volumes preserve Redis
sessions and the bot's rules-message state/plugin alert history. These are new
volumes: existing Redis sessions are not migrated, so users will need to sign in
again after switching the API. Back up volumes normally; deleting the resource's
volumes would remove this state.

The tracking list is baked into the bot image at `/app/data/plugins.json`.
Edit `bot/data/plugins.json` in Git and deploy a new image to update it. Runtime
state is separate at `/app/state`, so redeploys refresh the tracking list without
discarding notification history. Do not mount over `/app` or `/app/data` unless
you intend to manage the tracking list externally.

## 3. Connect deployments to GitHub Actions

After the first successful image build, obtain this Compose resource's deploy
webhook from Coolify and an authorized Coolify API token. Set these GitHub
repository Actions secrets:

| Secret                   | Value                                    |
| ------------------------ | ---------------------------------------- |
| `COOLIFY_DEPLOY_WEBHOOK` | Coolify deployment URL for this stack    |
| `COOLIFY_API_TOKEN`      | Token authorized to deploy this resource |

With neither secret present, the workflow only publishes images. With exactly one
present, it fails configuration validation. With both, it POSTs to the webhook
after both images publish. A successful request means deployment was queued;
check Coolify's logs for the actual rollout result.

Disable any parallel automatic deployment trigger that starts before image
publishing finishes. The intended production trigger is this workflow's webhook.
For a Git-connected Compose resource, ensure deployment uses the current main
revision so Compose changes are also picked up.

## 4. Switch from Pterodactyl

1. Keep the Minecraft server and DiscordSRV on Pterodactyl.
2. Verify Coolify can reach the Panel and Plan HTTPS endpoints.
3. Stop the old Pterodactyl bot before starting the Coolify bot; run one instance
   so scheduled jobs and Discord command registration do not run twice.
4. Deploy the Coolify stack. Verify backend `/health` returns 200 and the bot logs
   successful login and slash-command registration.
5. Route `api.mountaineercraft.net` to the Coolify backend. If the API URL changes,
   update the frontend's server-side `API_BASE_URL` and redeploy the frontend.
6. Check website sign-in, account linking, player listings and `/stats`, then run
   `/plugin-updates` in Discord as a member with Manage Server permission.
7. Stop the old API once traffic has moved. Do not run the old Git-polling watcher
   scripts inside these new images; image deployments handle code updates.

The existing OAuth redirect URI must remain registered in Discord. Keep a stable
`JWT_SECRET` and the Redis volume across later redeployments to preserve sessions.
To roll back, set both image overrides to the matching `:sha-<commit>` tags in
Coolify and redeploy. Reset them to `:latest` when resuming automatic updates.

## Local checks

```sh
docker build -t mountaineer-craft-bot ./bot
docker build -t mountaineer-craft-backend ./backend
docker compose --env-file coolify.env.example -f compose.production.yaml config --quiet
```

The example environment only validates the Compose structure. Supply real runtime
values to run services. The images use non-root users; the bot runs Node 24 and
the backend is a static Go binary with CA certificates for external HTTPS APIs.

References: [Yosef workflow](https://github.com/TheTeaCup/yosef/blob/main/.github/workflows/production.yml),
[Coolify Compose](https://coolify.io/docs/applications/builds/docker-compose),
[deployment webhooks](https://coolify.io/docs/core/automation/deploy-webhooks).
