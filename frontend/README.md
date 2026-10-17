## Cloudflare Workers / OpenNext

The OpenNext setup is already included; you do not need to run `migrate` again.
Run commands from `frontend/`, where this app's `package.json` lives. Use Node.js
22 or newer (Node 24 is recommended). OpenNext 1.20.12 requires Next.js 16.4.1
or newer; this project uses Next.js 16.4.2 and the matching Next.js packages.

```powershell
cd frontend
npm install
npm run preview
```

- `npm run dev`: normal Next.js development server.
- `npm run build:cloudflare`: build the Cloudflare Worker without deploying.
- `npm run preview`: build and run locally in the Workers runtime.
- `npm run deploy`: build and publish the Worker to your Cloudflare account.
- `npm run cf-typegen`: generate Cloudflare binding types.
- `npm run build` followed by `npm run test:auth`: run the production Node.js
  authentication regression tests.

`wrangler.jsonc` defines the Worker and non-secret production settings. The Go
API stays separately hosted; its Discord client secret, JWT secret, and Redis
credentials belong on the API server, not in the Worker configuration. Confirm
the Discord redirect URL and API origin before deployment. This setup does not
provision an R2 bucket or require ISR caching.

For local Worker development, copy `.dev.vars.example` to `.dev.vars` and use
Next.js `.env.local` files for local application settings. Keep those files out
of Git. OpenNext's Windows support is limited; use WSL or Linux CI if native
Windows build/preview tools fail.

The account gate uses Edge-compatible `src/middleware.ts`, because OpenNext's
Node middleware/`proxy.ts` support is experimental. Next.js 16 prints a middleware
deprecation notice; keep this convention until supported Node middleware is
available in OpenNext. Public browsing and account protection are unchanged.

## Authentication and Discord membership

The homepage, wiki, FAQ, and server-resource links are public and work without
login or Discord membership. Only `/me` and its subpages require a signed-in
Discord server member. The shared Chakra UI navbar and footer are used throughout.
The Go API is retained.

Deploy the frontend and API together. Existing browser-storage JWTs are no
longer accepted; users must sign in again. The frontend now needs a Next.js
server (`npm run build`, then `npm start`), not static-only hosting.

Frontend server environment variables:

- `API_BASE_URL`: Go API origin; defaults to `https://api.mountaineercraft.net`.
- `DISCORD_CLIENT_ID`: defaults to the existing Mountaineer Craft application ID.
- `DISCORD_REDIRECT_URI`: defaults to
  `https://mountaineercraft.net/oauth/discord`. It must match the API setting
  and an allowed redirect URI in the Discord application. For local development,
  configure both servers and Discord for `http://localhost:3000/oauth/discord`.

These settings stay on the server; do not prefix them with `NEXT_PUBLIC_`.
The API requires its existing Discord client credentials, a nonempty
`DISCORD_REQUIRED_GUILD_ID`, `JWT_SECRET`, and a working private Redis connection.
Do not expose Redis publicly: it now holds OAuth access tokens until the web
session expires, at most 24 hours.

OAuth state is verified server-side. The website stores only its session token
in an HttpOnly, SameSite cookie (Secure in production). Discord tokens and user
details remain in Redis. `/me` requires an unexpired session and a fresh Discord
membership check. Non-members receive HTTP 403 without profile data. Missing or
expired sessions receive 401; unavailable membership checks receive 503.
Every future private API group must use both `RequireSession()` and
`RequireDiscordMember()` middleware.

Next.js `src/middleware.ts` protects account HTML and Next.js account-data requests.
`requiresMembership()` in `src/lib/auth.ts` defines protected account routes;
add future private page roots there. The shared client gate also checks on
navigation, tab focus, and once per minute while visible. Public pages render
immediately, even if optional session checks fail or the API is unavailable.
The login/OAuth, Discord join, logout, and temporary error pages are accessible
without membership. The Discord invite opens separately; “I’ve joined — check
again” verifies current membership without repeating OAuth. Leaving the server
removes access at the next check. Signing out revokes the Redis session.

Membership uses Discord’s existing `guilds` OAuth scope and
[Get Current User Guilds](https://discord.com/developers/docs/resources/user#get-current-user-guilds).
No bot token or additional scope is required.

## Wiki

The build bundles Markdown files from the repository's `wiki/` folder for the
server, so Workers do not need access to a local filesystem. For example,
`wiki/getting-started.md` is served at
`/wiki/getting-started`, and `wiki/guides/grief-prevention.md` is served at
`/wiki/guides/grief-prevention`. New `.md` files automatically appear in the wiki
index and navigation. The `prebuild` and `predev` hooks generate the bundle
automatically. While a dev server is running, use `npm run wiki:generate` after
editing Markdown. Deploy updated articles with the website. Wiki article
pages and their Next.js data responses are available to everyone.

Optional YAML front matter supplies a `title` and `description`. Without a title,
the filename is used. Relative links to other Markdown files are converted to
wiki URLs. Empty articles remain accessible and are marked as coming soon;
their contents are never filled in automatically.

```md
---
title: Getting Started
description: First steps on Mountaineer Craft
---

# Getting Started

Your article content goes here.
```

## Thoughts
- allow users to login with their discord account on the website and let them get some stats and other stuff
- if a user is logged in then they can view players that are currently online and in game (cool feature)
- https://www.minecartrapidtransit.net/commands/
- 
