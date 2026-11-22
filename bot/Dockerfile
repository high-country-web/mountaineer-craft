FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    BOT_STATE_DIR=/app/state \
    PLUGIN_UPDATES_FILE=/app/data/plugins.json \
    PLUGIN_UPDATES_STATE_FILE=/app/state/plugin-update-state.json
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node src/data/rules.txt src/data/rulesMessage.json ./src/data/
COPY --chown=node:node data/plugins.json ./data/plugins.json
RUN mkdir -p /app/state && chown node:node /app/state
USER node
CMD ["node", "dist/index.js"]
