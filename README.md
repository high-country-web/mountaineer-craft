# Mountaineer Craft

- `frontend/`: Next.js website, public player directory, wiki, and Discord member profile.
- `backend/`: Go API for Discord sessions and Plan player analytics.
- `bot/`: Discord bot.
- `wiki/`: Markdown articles bundled into the website.

See [frontend setup](frontend/README.md) and [backend configuration](backend/readme.md)
for service-specific instructions.

## Code formatting

Install the shared formatter from the repository root:

```sh
npm ci
```

Format all supported source files, styles, configuration, and documentation with
Prettier, and all backend Go files with `gofmt`:

```sh
npm run format
```

Check formatting without modifying files:

```sh
npm run format:check
```

Node.js and Go must be available on your PATH. Both the frontend and bot expose
the same commands and delegate to the shared root configuration. The root pins
Prettier so contributors use the same formatting. Generated output, dependencies,
lockfiles, and environment secrets are excluded. `.editorconfig` supplies matching
editor indentation and line endings; a Prettier editor extension can use the root
configuration for formatting on save.
