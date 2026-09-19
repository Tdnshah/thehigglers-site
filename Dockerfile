# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS build
# astro.config.mjs reads DATABASE_URL/UPLOADS_DIR at config-evaluation time
# (during `astro build`), not per-request -- so these must be set here, not
# just at container runtime, or the build silently falls back to the dev
# defaults ("./data.db", "./uploads") baked into the server bundle.
ENV DATABASE_URL=file:/app/data/data.db
ENV UPLOADS_DIR=/app/uploads
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Bake the production seed (schema + real site identity, no demo content).
# .emdash/seed.json takes priority over seed/seed.json, so this is picked up
# at build time without touching the seed/ files used by local dev.
RUN mkdir -p .emdash && cp seed/seed.prod.json .emdash/seed.json
RUN pnpm build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN groupadd --system app && useradd --system --gid app app \
	&& mkdir -p /app/data /app/uploads \
	&& chown -R app:app /app

USER app

EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "./dist/server/entry.mjs"]
