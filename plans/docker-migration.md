# Cloudify — PM2 to Docker Migration Plan

Status: Planned — 2026-04-05

---

## Current State

### Cloudify Platform

| Component | Runtime | Port | Config Source |
|-----------|---------|------|---------------|
| cloudify-web (Next.js) | PM2 → bun → `next start` | 3001 | `ecosystem.config.cjs` |
| cloudify-api (Express) | PM2 → bun → `dist/index.js` | 4000 | `ecosystem.config.cjs` |
| cloudify-postgres | Docker container | 5433→5432 | `docker-compose.cloudify.yml` |
| cloudify-convex | Docker container | 3213→3210, 3214→3211 | `docker-compose.cloudify.yml` |

### User Deployments (Managed by Cloudify)

Each lives in `/opt/cloudify/deployments/<name>/docker-compose.yml`:
- `aegis` — ports 3210-3211, 5432, 6791
- `agies` — ports 10210-10213
- `database` — ports 10214-10217

Each has its own Postgres, Convex backend, Convex dashboard with named Docker volumes.

### Other Services on the Host

- `nginx-proxy-manager` — ports 80, 81, 443 (reverse proxy + SSL)
- `dbsevarthi-nextjs` — port 3000 (separate app, not Cloudify-managed)
- `coolify-sentinel` — monitoring

---

## Target State

All Cloudify platform components run as Docker containers in a single compose stack. User deployments and other services remain untouched.

| Component | Runtime | Port | Image |
|-----------|---------|------|-------|
| cloudify-web | Docker | 3001→3000 | `ghcr.io/devibuilds/cloudify-web:latest` |
| cloudify-api | Docker | 4000→4000 | `ghcr.io/devibuilds/cloudify-api:latest` |
| cloudify-postgres | Docker (unchanged) | 5433→5432 | `postgres:16-alpine` |
| cloudify-convex | Docker (unchanged) | 3213→3210, 3214→3211 | `ghcr.io/get-convex/convex-backend:latest` |

---

## What Changes

| Item | Before | After |
|------|--------|-------|
| Web/API process manager | PM2 (`ecosystem.config.cjs`) | Docker Compose |
| Web/API env vars | Hardcoded in `ecosystem.config.cjs` | GitHub Secrets → written to `.env` on VPS at deploy time |
| Web/API deployment | rsync `.next/` + `dist/` → PM2 restart | `docker compose pull` → `docker compose up -d` |
| Build artifacts shipped | Raw JS files via rsync | Docker images via ghcr.io |
| GitHub Actions deploy job | rsync + PM2 restart | Write `.env` → docker compose pull + up |
| Secrets management | Scattered across `ecosystem.config.cjs` + VPS `.env` | Single source: GitHub Secrets |

## What Does NOT Change

- `cloudify-postgres` and `cloudify-convex` containers — same compose, same volumes, same ports
- User deployments in `/opt/cloudify/deployments/` — untouched
- Nginx Proxy Manager — untouched, same port mappings
- Cloudflare DNS records — no change
- NPM proxy host configs — no change (web still on 3001, API still on 4000)
- `dbsevarthi-nextjs` on port 3000 — unrelated, untouched

---

## Secrets Management

**Approach: GitHub Secrets → write `.env` to VPS at deploy time**

All secrets live in GitHub Actions as repository secrets — the single source of truth. During every deploy, the workflow writes a fresh `.env` file to the VPS over SSH before running `docker compose up`.

### Why This Approach

- **Single source of truth** — all secrets managed in one place (`github.com/deviBuilds/cloudify/settings/secrets/actions`)
- **No stale secrets on disk** — `.env` is rewritten on every deploy, always current
- **Easy rotation** — `gh secret set VAR_NAME` then push any commit to trigger deploy
- **Auditable** — GitHub logs who changed secrets and when
- **No extra tooling** — no Vault, SOPS, or external services to maintain

### GitHub Secrets Required

| Secret | Used By | Purpose |
|--------|---------|---------|
| `INFRA_AGENT_SECRET` | web, api, convex | Shared auth between Convex actions and infra agent |
| `CLOUDFLARE_API_TOKEN` | api | DNS record management |
| `CLOUDFLARE_ZONE_ID` | api | Target DNS zone |
| `CLOUDFLARE_ACCOUNT_ID` | api | Cloudflare account |
| `NPM_EMAIL` | api | Nginx Proxy Manager login |
| `NPM_PASSWORD` | api | Nginx Proxy Manager login |
| `CLOUDIFY_DB_PASSWORD` | postgres, convex | Cloudify's own Convex Postgres password |
| `NEXT_PUBLIC_CONVEX_URL` | web (build-time) | Convex backend URL for frontend |
| `CONVEX_ADMIN_KEY` | deploy step | Convex schema push |
| `GH_PAT` | build-and-push job | ghcr.io image push |
| `SSH_PRIVATE_KEY` | deploy job | VPS SSH access |
| `SSH_HOST` | deploy job | VPS IP address |
| `SSH_USER` | deploy job | VPS SSH username |

### How `.env` Is Written

The deploy workflow writes the `.env` file to the VPS before running `docker compose up`:

```yaml
- name: Write environment file
  run: |
    ssh -i ~/.ssh/deploy_key ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
      "cat > /opt/cloudify/.env << 'ENVEOF'
    # Written by GitHub Actions deploy — do not edit manually
    # Source of truth: github.com/deviBuilds/cloudify/settings/secrets/actions

    # Infra Agent
    INFRA_AGENT_SECRET=${{ secrets.INFRA_AGENT_SECRET }}

    # Cloudflare
    CLOUDFLARE_API_TOKEN=${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ZONE_ID=${{ secrets.CLOUDFLARE_ZONE_ID }}
    CLOUDFLARE_ACCOUNT_ID=${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

    # Nginx Proxy Manager
    NPM_EMAIL=${{ secrets.NPM_EMAIL }}
    NPM_PASSWORD=${{ secrets.NPM_PASSWORD }}

    # Cloudify Postgres
    CLOUDIFY_DB_PASSWORD=${{ secrets.CLOUDIFY_DB_PASSWORD }}
    ENVEOF
    chmod 600 /opt/cloudify/.env"
```

The `.env` file is `chmod 600` — only the deploy user can read it. The compose file references these vars via `${VAR}` syntax.

### Secret Rotation Workflow

To rotate any secret:
1. `gh secret set SECRET_NAME --repo deviBuilds/cloudify` (enter new value)
2. Push any commit or trigger deploy manually: `gh workflow run deploy.yml`
3. Workflow writes new `.env` → `docker compose up -d` picks up new values
4. Done — no SSH into server needed

---

## Data Loss Risk Assessment

| Data | Storage | Risk | Mitigation |
|------|---------|------|------------|
| Cloudify's Convex DB | Docker volume `cloudify_pgdata` | None — container not restarted | Don't touch postgres/convex services |
| Cloudify's Convex files | Docker volume `cloudify_convex_data` | None — container not restarted | Same |
| User deployment data (aegis, agies, database) | Per-deployment Docker volumes | None — completely separate compose stacks | Not part of this migration |
| NPM proxy configs | NPM container data | None — not touched | Not part of this migration |
| Convex schema/functions | Deployed to cloudify-convex | None — schema persists in DB | Re-deploy schema after migration as verification |

**Key safety rule:** Never run `docker compose down -v` on the cloudify compose stack. The `-v` flag deletes volumes. Use `docker compose up -d` which only recreates changed services.

---

## Implementation Steps

### Step 1: Add All Secrets to GitHub

Run these locally (one-time setup):

```bash
gh secret set INFRA_AGENT_SECRET --repo deviBuilds/cloudify
gh secret set CLOUDFLARE_API_TOKEN --repo deviBuilds/cloudify
gh secret set CLOUDFLARE_ZONE_ID --repo deviBuilds/cloudify
gh secret set CLOUDFLARE_ACCOUNT_ID --repo deviBuilds/cloudify
gh secret set NPM_EMAIL --repo deviBuilds/cloudify
gh secret set NPM_PASSWORD --repo deviBuilds/cloudify
gh secret set CLOUDIFY_DB_PASSWORD --repo deviBuilds/cloudify
```

Values come from the current `ecosystem.config.cjs` and VPS `.env`.

### Step 2: Update `docker-compose.cloudify.yml`

Add `cloudify-web` and `cloudify-api` services to the existing compose file alongside postgres and convex. All env vars reference `${VAR}` from `.env` — no hardcoded secrets in compose.

```yaml
services:
  # --- Existing (unchanged) ---
  cloudify-postgres:
    # ... (keep as-is)

  cloudify-convex:
    # ... (keep as-is)

  # --- New ---
  cloudify-web:
    image: ghcr.io/devibuilds/cloudify-web:latest
    container_name: cloudify-web
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - PORT=3000
      - HOSTNAME=0.0.0.0
      - NODE_ENV=production
      - NEXT_PUBLIC_CONVEX_URL=https://convex.projectinworks.com
      - INFRA_AGENT_URL=http://cloudify-api:4000
      - INFRA_AGENT_SECRET=${INFRA_AGENT_SECRET}
    depends_on:
      cloudify-convex:
        condition: service_healthy

  cloudify-api:
    image: ghcr.io/devibuilds/cloudify-api:latest
    container_name: cloudify-api
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - NODE_ENV=production
      - INFRA_AGENT_SECRET=${INFRA_AGENT_SECRET}
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
      - CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID}
      - CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}
      - NPM_URL=http://host.docker.internal:81
      - NPM_EMAIL=${NPM_EMAIL}
      - NPM_PASSWORD=${NPM_PASSWORD}
      - SERVER_IP=146.235.212.232
      - BASE_DOMAIN=devhomelab.org
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      cloudify-convex:
        condition: service_healthy
```

**Important notes:**
- Web maps `3001:3000` — externally still port 3001 so NPM routing doesn't break
- API uses `host.docker.internal` for NPM (running outside this compose stack)
- API mounts Docker socket for container management
- Web talks to API via Docker network (`cloudify-api:4000`) instead of localhost
- `INFRA_AGENT_URL` changes from `http://localhost:4000` to `http://cloudify-api:4000`
- No `env_file` directive — all vars are explicit in the compose file, values come from `.env` via `${VAR}` interpolation
- The `.env` file sits at `/opt/cloudify/.env` — compose reads it automatically when run from `/opt/cloudify/app/docker/` with `--env-file /opt/cloudify/.env`

### Step 3: Update GitHub Actions Deploy Workflow

Replace the entire deploy job with:

```yaml
deploy:
  needs: build-and-push
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 24

    - name: Setup SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/deploy_key
        chmod 600 ~/.ssh/deploy_key
        ssh-keyscan -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts

    - name: Write environment file to VPS
      run: |
        ssh -i ~/.ssh/deploy_key ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cat > /opt/cloudify/.env << 'ENVEOF'
        INFRA_AGENT_SECRET=${{ secrets.INFRA_AGENT_SECRET }}
        CLOUDFLARE_API_TOKEN=${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ZONE_ID=${{ secrets.CLOUDFLARE_ZONE_ID }}
        CLOUDFLARE_ACCOUNT_ID=${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        NPM_EMAIL=${{ secrets.NPM_EMAIL }}
        NPM_PASSWORD=${{ secrets.NPM_PASSWORD }}
        CLOUDIFY_DB_PASSWORD=${{ secrets.CLOUDIFY_DB_PASSWORD }}
        ENVEOF
        chmod 600 /opt/cloudify/.env"

    - name: Sync compose file
      run: |
        scp -i ~/.ssh/deploy_key \
          docker/docker-compose.cloudify.yml \
          ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:/opt/cloudify/app/docker/docker-compose.cloudify.yml

    - name: Pull and restart containers
      run: |
        ssh -i ~/.ssh/deploy_key ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
          "cd /opt/cloudify/app/docker && \
           docker compose --env-file /opt/cloudify/.env -f docker-compose.cloudify.yml pull cloudify-web cloudify-api && \
           docker compose --env-file /opt/cloudify/.env -f docker-compose.cloudify.yml up -d cloudify-web cloudify-api"

    - name: Deploy Convex schema
      run: |
        cd apps/convex && npx convex deploy \
          --url https://convex.projectinworks.com \
          --admin-key '${{ secrets.CONVEX_ADMIN_KEY }}'

    - name: Health check
      run: |
        sleep 5
        curl -sf --max-time 10 https://projectinworks.com/ > /dev/null \
          && echo "Health check passed" \
          || echo "Health check failed (site may still be starting)"
```

**Flow:**
1. Write `.env` from GitHub Secrets to VPS (fresh every deploy)
2. SCP the compose file (in case it changed)
3. Pull latest images for web + api only
4. `docker compose up -d` — only recreates web + api, postgres/convex untouched
5. `npx convex deploy` runs directly on GitHub Actions runner against the public Convex URL — no SSH, no rsync of source files needed
6. Health check

### Step 4: Convex Schema Deployment

**Decision: Post-deploy step, run directly from GitHub Actions runner**

Why:
- Source files are already checked out on the runner — no rsync needed
- Convex backend is publicly accessible at `https://convex.projectinworks.com`
- `npx convex deploy` is just an HTTP push — doesn't need to be on the VPS
- If schema deploy fails, web/api containers still run with the previous schema (backwards compatible)
- Entrypoint failure = container crash loop = downtime, so post-deploy is safer
- Zero VPS dependencies — no nvm, no npx, no source files on server

### Step 5: Docker Login on VPS (One-Time)

The VPS needs to pull from `ghcr.io`. One-time setup:

```bash
ssh -i ~/.ssh/ssh-key-2025-08-02.key ubuntu@146.235.212.232 \
  "echo '<GH_PAT>' | docker login ghcr.io -u deviBuilds --password-stdin"
```

Docker stores credentials in `~/.docker/config.json`. Persists across reboots.

---

## Migration Execution (One-Time)

This is the actual cutover procedure. Expected downtime: ~10 seconds (between PM2 stop and Docker container start).

```bash
# 1. SSH into VPS
ssh -i ~/.ssh/ssh-key-2025-08-02.key ubuntu@146.235.212.232

# 2. Login to ghcr.io (one-time)
echo "ghp_..." | docker login ghcr.io -u deviBuilds --password-stdin

# 3. Write .env (will be automated by CI after migration, but need it for first run)
cat > /opt/cloudify/.env << 'EOF'
INFRA_AGENT_SECRET=OmK5JrRKXnwzkfcaBdNWwdYpxxqKjEHXufghpQ1t
CLOUDFLARE_API_TOKEN=<value>
CLOUDFLARE_ZONE_ID=<value>
CLOUDFLARE_ACCOUNT_ID=<value>
NPM_EMAIL=<value>
NPM_PASSWORD=<value>
CLOUDIFY_DB_PASSWORD=<existing-value>
EOF
chmod 600 /opt/cloudify/.env

# 4. Pull new images
cd /opt/cloudify/app/docker
docker compose --env-file /opt/cloudify/.env -f docker-compose.cloudify.yml pull cloudify-web cloudify-api

# 5. Stop PM2 processes
source ~/.nvm/nvm.sh
pm2 stop cloudify-web cloudify-api

# 6. Start Docker containers
docker compose --env-file /opt/cloudify/.env -f docker-compose.cloudify.yml up -d cloudify-web cloudify-api

# 7. Verify containers are running
docker ps | grep cloudify

# 8. Test the app
curl -sf https://projectinworks.com/ && echo "OK"

# 9. If everything works, remove PM2 processes
pm2 delete cloudify-web cloudify-api
pm2 save

# 10. If something goes WRONG, rollback:
# docker compose --env-file /opt/cloudify/.env -f docker-compose.cloudify.yml stop cloudify-web cloudify-api
# pm2 start ecosystem.config.cjs
```

---

## GitHub Actions Deploy Flow (After Migration)

```
Push to main
    ↓
build-and-push job (GitHub Actions runner):
    Build web + api Docker images (amd64 + arm64)
    Push to ghcr.io/devibuilds/cloudify-web:latest + :sha
    Push to ghcr.io/devibuilds/cloudify-api:latest + :sha
    ↓
deploy job (GitHub Actions runner):
    ├── SSH: Write /opt/cloudify/.env from GitHub Secrets
    ├── SCP: docker-compose.cloudify.yml → VPS
    ├── SSH: docker compose pull cloudify-web cloudify-api
    ├── SSH: docker compose up -d cloudify-web cloudify-api
    ├── LOCAL: npx convex deploy (runner → public Convex URL, no VPS needed)
    └── LOCAL: curl health check
```

**Zero rsync. Zero PM2. Zero build-on-server.** Only SSH for container orchestration + env file. Convex deploy runs directly from the runner against the public URL. Secrets never hardcoded anywhere.

---

## Files to Modify

| File | Change |
|------|--------|
| `docker/docker-compose.cloudify.yml` | Add cloudify-web and cloudify-api services |
| `.github/workflows/deploy.yml` | Replace rsync+PM2 with write-env + docker compose pull+up |
| `scripts/deploy.sh` | Update for Docker-based deploy (local fallback) |

**Files unchanged:**

| File | Why |
|------|-----|
| `.github/workflows/ci.yml` | No change needed — CI is just lint+build |
| `apps/web/Dockerfile` | Already correct |
| `apps/api/Dockerfile` | Already correct |

**Files to remove after migration:**

| File | Why |
|------|-----|
| `ecosystem.config.cjs` | No longer needed — PM2 replaced by Docker |

---

## Rollback Plan

If Docker containers fail after migration:

1. `docker compose --env-file /opt/cloudify/.env -f docker-compose.cloudify.yml stop cloudify-web cloudify-api`
2. `pm2 start ecosystem.config.cjs`
3. Verify app is back at `https://projectinworks.com/`

PM2 config and node_modules remain on disk until we're confident in Docker. Don't delete them until at least 1 week of stable Docker operation.

---

## Post-Migration Cleanup (After 1 Week)

- Remove `ecosystem.config.cjs` from repo and VPS
- Remove rsync steps from `scripts/deploy.sh`
- Remove PM2 from VPS (`npm uninstall -g pm2`)
- Remove stale build artifacts from `/opt/cloudify/app/apps/web/.next/` and `/opt/cloudify/app/apps/api/dist/`
- Update README with Docker-based deploy instructions
- Remove old deploy-related GitHub secrets that are no longer needed (SSH key stays)
