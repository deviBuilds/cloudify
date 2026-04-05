# Cloudify

Self-hosted deployment management platform. Deploy and manage Convex instances (with Postgres and SpaceTimeDB planned) through a web dashboard with real-time updates, DNS automation, and container orchestration.

## Architecture

```
┌─────────────┐     real-time subs     ┌──────────────────┐
│  Next.js    │◄──────────────────────►│  Convex Backend  │
│  (web)      │     mutations/queries  │  (self-hosted)   │
└──────┬──────┘                        └────────┬─────────┘
       │ REST (infra ops)                       │ actions
       ▼                                        ▼
┌─────────────┐
│  Express    │──► Docker Engine (containers, compose, stats)
│  (infra     │──► Cloudflare API (DNS records)
│   agent)    │──► Nginx Proxy Manager (reverse proxy, SSL)
└─────────────┘
```

- **Next.js** connects to Convex for all data (real-time subscriptions, no polling)
- **Express infra agent** handles host operations (Docker, DNS, system metrics)
- **Convex actions** orchestrate deployments by calling the infra agent

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Convex DB (self-hosted), Express.js |
| Containers | Docker, dockerode, Docker Compose |
| DNS | Cloudflare API (proxied A records) |
| Reverse Proxy | Nginx Proxy Manager (auto SSL via Let's Encrypt) |
| Monitoring | systeminformation, Recharts |
| Monorepo | Turborepo, Bun workspaces |
| CI/CD | GitHub Actions, GitHub Container Registry |

## Prerequisites

- **Node.js 24+**
- **Bun** (package manager)
- **Docker** (for managed deployments)
- **Cloudflare account** with API token (Zone:DNS:Edit, Zone:Zone:Read)
- **Nginx Proxy Manager** instance with wildcard SSL cert
- **Self-hosted Convex backend** (via Docker)

## Quick Start (Local Development)

```bash
# Clone
git clone git@github.com:deviBuilds/cloudify.git
cd cloudify

# Environment
cp .env.example .env
# Fill in required values (see .env.example for descriptions)

# Install dependencies
bun install

# Start Cloudify's own Convex + Postgres
docker compose -f docker/docker-compose.dev.yml up -d cloudify-postgres cloudify-convex

# Start Convex dev server (generates types, syncs schema)
cd apps/convex && npx convex dev &

# Start all services
npx turbo dev

# Open http://localhost:3000
```

## Production Deployment

### Server Requirements

- Ubuntu 22.04+ VPS
- Docker + Docker Compose
- Node.js 24 (via nvm)
- PM2 (process manager)
- Nginx Proxy Manager
- Cloudflare DNS for your domain

### Environment Variables

See `.env.example` for the full list. Key secrets:

| Variable | Purpose |
|----------|---------|
| `CLOUDFLARE_API_TOKEN` | DNS record management |
| `CLOUDFLARE_ZONE_ID` | Target DNS zone |
| `NPM_EMAIL` / `NPM_PASSWORD` | Nginx Proxy Manager auth |
| `INFRA_AGENT_SECRET` | Shared secret between Convex and infra agent |
| `NEXT_PUBLIC_CONVEX_URL` | Convex backend URL for the frontend |
| `CONVEX_DEPLOY_KEY` | Convex schema deployment key |

### Manual Deploy

```bash
# Set required env vars
export CONVEX_ADMIN_KEY="your-admin-key"
export NEXT_PUBLIC_CONVEX_URL="https://convex.yourdomain.com"

# Deploy everything
./scripts/deploy.sh

# Skip build (use existing artifacts)
./scripts/deploy.sh --skip-build

# Skip Convex schema deploy
./scripts/deploy.sh --skip-convex
```

### Automated Deploy (CI/CD)

Push to `main` triggers the GitHub Actions deploy workflow which:

1. Builds all packages
2. Builds and pushes Docker images to `ghcr.io/devibuilds/cloudify-web` and `ghcr.io/devibuilds/cloudify-api`
3. Rsyncs build artifacts to the VPS
4. Deploys Convex functions
5. Restarts PM2 services
6. Runs a health check

#### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `GH_PAT` | GitHub PAT with `write:packages` scope |
| `SSH_PRIVATE_KEY` | VPS SSH private key |
| `SSH_HOST` | VPS IP address |
| `SSH_USER` | SSH username (e.g., `ubuntu`) |
| `CONVEX_ADMIN_KEY` | Convex admin key for schema deploy |
| `NEXT_PUBLIC_CONVEX_URL` | Convex URL for frontend build |

## Project Structure

```
cloudify/
├── apps/
│   ├── web/              # Next.js frontend (dashboard, wizards, metrics)
│   ├── api/              # Express infra agent (Docker, DNS, system ops)
│   └── convex/           # Convex functions (schema, queries, mutations, actions)
├── packages/
│   ├── shared/           # Shared types and Zod schemas
│   ├── docker-manager/   # Docker/dockerode wrapper
│   └── domain-manager/   # Cloudflare DNS + Nginx Proxy Manager
├── docker/               # Docker Compose files (dev + prod)
├── scripts/              # Deploy and setup scripts
├── plans/                # Architecture and implementation docs
├── cloudify.config.yml   # Platform configuration
└── turbo.json            # Turborepo build pipeline
```

## Configuration

All configuration lives in `cloudify.config.yml`. Secrets should be set via environment variables (never committed). See the config file for inline documentation of every field.

Key sections:
- **server** — ports, bind address, public IP
- **domain** — base domain, scheme, wildcard fallback
- **cloudflare** — DNS provider settings
- **nginxProxyManager** — reverse proxy settings
- **ports** — auto-assignable port range for deployments
- **services** — enabled service types and Docker images

## License

Private
