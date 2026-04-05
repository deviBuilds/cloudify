# Phase E: CI/CD, Deploy Scripts & README

Status: Planned — 2026-04-04

---

## Context

Current deployment is fully manual: run `scripts/deploy.sh` which builds locally, rsyncs build artifacts to the VPS, deploys Convex functions, and restarts PM2. No automated CI/CD exists. No GitHub Actions workflows. No web Dockerfile.

**Goals:**
1. GitHub Actions CI pipeline (lint, typecheck, build on every PR)
2. GitHub Actions CD pipeline (deploy to VPS on push to `main`)
3. Web Dockerfile for containerized builds
4. Improved deploy script (idempotent, can be called from CI or locally)
5. Comprehensive README

---

## Phase E.1: Web Dockerfile

**Why:** API already has a Dockerfile. Web needs one for consistent CI builds and future Docker Compose production deployment.

### File: `apps/web/Dockerfile`

Multi-stage build:
```
Stage 1 (deps):     node:24-alpine, install bun, copy package.json + lockfile, bun install
Stage 2 (builder):  copy source, set NEXT_PUBLIC_CONVEX_URL as build arg, bun run build
Stage 3 (prod):     node:24-alpine, copy .next/standalone + .next/static + public, CMD node server.js
```

### File: `apps/web/next.config.ts`

Add `output: "standalone"` — produces a self-contained `.next/standalone/` directory (~100MB vs ~500MB) with embedded node_modules. Required for the Docker prod stage.

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
};
```

### Files to modify/create

| File | Change |
|------|--------|
| `apps/web/Dockerfile` | New — multi-stage production build |
| `apps/web/next.config.ts` | Add `output: "standalone"` |
| `apps/web/.dockerignore` | New — exclude node_modules, .next, .env |

### Estimate: Small

---

## Phase E.2: GitHub Actions CI Pipeline

**Why:** Catch build/type/lint errors before merge. No tests exist yet, so CI = lint + typecheck + build.

### File: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node 24
      - Setup Bun
      - Install deps (bun install)
      - Lint (npx turbo lint)
      - Typecheck (npx turbo typecheck)
      - Build (npx turbo build) with NEXT_PUBLIC_CONVEX_URL set to placeholder
    
    env:
      NEXT_PUBLIC_CONVEX_URL: "https://placeholder.convex.cloud"
```

**Notes:**
- Convex codegen types won't exist in CI, but `ignoreBuildErrors: true` in next.config handles this
- `turbo build` handles build order (shared → docker-manager/domain-manager → api → web)
- Cache `node_modules` and `.turbo` for speed

### Estimate: Small

---

## Phase E.3: GitHub Actions CD Pipeline (Deploy to VPS)

**Why:** Automate the current manual deploy.sh workflow. On push to `main`, build and deploy everything.

### File: `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:  # manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - Checkout
      - Setup Node 24
      - Setup Bun
      - Install deps
      - Build all (npx turbo build --force)
      - Setup SSH key (from GitHub secret)
      - Rsync packages/shared/dist/
      - Rsync packages/domain-manager/dist/
      - Rsync packages/docker-manager/dist/
      - Rsync apps/api/dist/
      - Rsync apps/web/.next/ (--delete)
      - Rsync apps/convex/convex/
      - Rsync cloudify.config.yml
      - Deploy Convex functions via SSH
      - Restart PM2 services via SSH
```

### GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `SSH_PRIVATE_KEY` | SSH key for VPS access |
| `SSH_HOST` | `146.235.212.232` |
| `SSH_USER` | `ubuntu` |
| `CONVEX_ADMIN_KEY` | For `npx convex deploy` on server |
| `NEXT_PUBLIC_CONVEX_URL` | `https://convex.projectinworks.com` |

### File: `scripts/deploy.sh` (update)

Refactor existing script to:
- Accept optional `--skip-build` flag (CI already built)
- Accept `--skip-convex` flag (skip Convex deploy if only frontend changed)
- Remove hardcoded admin key (use env var `CONVEX_ADMIN_KEY`)
- Add SSH connection test before starting
- Add post-deploy health check (curl production URL)
- Print deployment summary at end

### Estimate: Medium

---

## Phase E.4: README

**Why:** No root README exists. New contributors and the user's own future self need setup docs.

### File: `README.md`

Sections:
1. **What is Cloudify** — one-paragraph description + screenshot
2. **Architecture** — simplified data flow diagram (reference `plans/architecture-plan.md` for full detail)
3. **Tech Stack** — table of key technologies
4. **Prerequisites** — Node 24, Bun, Docker, Cloudflare account, Nginx Proxy Manager
5. **Quick Start (Local Dev)**
   - Clone repo
   - `cp .env.example .env` + fill in values
   - `bun install`
   - Start Convex backend (`docker compose -f docker/docker-compose.dev.yml up -d cloudify-postgres cloudify-convex`)
   - `npx convex dev` in `apps/convex/`
   - `npx turbo dev`
   - Open `http://localhost:3000`
6. **Production Deployment**
   - Server setup (Ubuntu, Docker, PM2, NPM)
   - Environment variables
   - `scripts/deploy.sh` usage
   - PM2 ecosystem config
7. **CI/CD** — GitHub Actions workflows overview
8. **Project Structure** — abbreviated tree with descriptions
9. **Configuration** — `cloudify.config.yml` fields explained
10. **License**

### File: `cloudify.config.yml` (update)

Add inline YAML comments for every field explaining purpose and valid values.

### Estimate: Medium

---

## Execution Order

```
E.1 (Web Dockerfile)           — no deps, enables E.3
  ↓
E.2 (CI Pipeline)              — independent, can parallel with E.1
  ↓
E.3 (CD Pipeline + deploy.sh)  — depends on E.1 for build consistency
  ↓
E.4 (README + config comments) — do last, references CI/CD setup
```

E.1 and E.2 can run in parallel.

---

## Files Summary

**New (5):**

| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/Dockerfile` | E.1 | Multi-stage Next.js production build |
| `apps/web/.dockerignore` | E.1 | Docker build exclusions |
| `.github/workflows/ci.yml` | E.2 | PR lint/typecheck/build |
| `.github/workflows/deploy.yml` | E.3 | Auto-deploy on push to main |
| `README.md` | E.4 | Project documentation |

**Modified (3):**

| File | Phase | Change |
|------|-------|--------|
| `apps/web/next.config.ts` | E.1 | Add `output: "standalone"` |
| `scripts/deploy.sh` | E.3 | Add flags, remove hardcoded secrets, add health check |
| `cloudify.config.yml` | E.4 | Add inline comments |

---

## GitHub Secrets Setup Checklist

Before the CD pipeline works:
1. Create GitHub environment `production`
2. Add `SSH_PRIVATE_KEY` secret (contents of `~/.ssh/ssh-key-2025-08-02.key`)
3. Add `SSH_HOST` secret (`146.235.212.232`)
4. Add `SSH_USER` secret (`ubuntu`)
5. Add `CONVEX_ADMIN_KEY` secret
6. Add `NEXT_PUBLIC_CONVEX_URL` secret (`https://convex.projectinworks.com`)
