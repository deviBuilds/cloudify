# --- Base ---
FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g bun

# --- Dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/docker-manager/package.json packages/docker-manager/
COPY packages/domain-manager/package.json packages/domain-manager/
RUN bun install

# --- Dev ---
FROM deps AS dev
COPY . .
CMD ["bun", "run", "--filter", "@cloudify/api", "dev"]

# --- Build ---
FROM deps AS builder
COPY . .
ENV PATH="/app/node_modules/.bin:$PATH"
RUN bun run --filter @cloudify/shared build && \
    bun run --filter @cloudify/docker-manager build && \
    bun run --filter @cloudify/domain-manager build && \
    bun run --filter @cloudify/api build

# --- Prod ---
FROM node:24-alpine AS prod
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/cloudify.config.yml ./
# Strip workspace refs from package.json, then install all external prod deps
RUN node -e " \
  const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); \
  Object.keys(p.dependencies||{}).forEach(k => { if(String(p.dependencies[k]).startsWith('workspace:')) delete p.dependencies[k]; }); \
  require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));" \
  && npm install --omit=dev --ignore-scripts \
  && npm install --no-save dockerode@^4.0.0 cloudflare@^4.4.0 zod@^3.24.0
# Copy workspace packages AFTER npm install (so they don't get wiped)
COPY --from=builder /app/packages/shared/dist ./node_modules/@cloudify/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@cloudify/shared/package.json
COPY --from=builder /app/packages/docker-manager/dist ./node_modules/@cloudify/docker-manager/dist
COPY --from=builder /app/packages/docker-manager/package.json ./node_modules/@cloudify/docker-manager/package.json
COPY --from=builder /app/packages/domain-manager/dist ./node_modules/@cloudify/domain-manager/dist
COPY --from=builder /app/packages/domain-manager/package.json ./node_modules/@cloudify/domain-manager/package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
