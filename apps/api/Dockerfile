# --- Base ---
FROM oven/bun:1 AS base
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/docker-manager/package.json packages/docker-manager/
COPY packages/domain-manager/package.json packages/domain-manager/
RUN bun install --frozen-lockfile

# --- Dev ---
FROM deps AS dev
COPY . .
CMD ["bun", "run", "--filter", "@cloudify/api", "dev"]

# --- Build ---
FROM deps AS builder
COPY . .
RUN bun run --filter @cloudify/shared build && \
    bun run --filter @cloudify/docker-manager build && \
    bun run --filter @cloudify/domain-manager build && \
    bun run --filter @cloudify/api build

# --- Prod ---
FROM node:24-alpine AS prod
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/cloudify.config.yml ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
