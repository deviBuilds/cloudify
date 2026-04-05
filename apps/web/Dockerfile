FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN npm install -g bun

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/convex/package.json ./apps/convex/
COPY packages/shared/package.json ./packages/shared/
COPY packages/docker-manager/package.json ./packages/docker-manager/
COPY packages/domain-manager/package.json ./packages/domain-manager/
RUN bun install

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY . .

ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
ENV PATH="/app/node_modules/.bin:$PATH"

RUN turbo build --filter=@cloudify/web

# --- Production ---
FROM node:24-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
