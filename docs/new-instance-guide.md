# Cloudify — New Instance Setup Guide

How to deploy Cloudify to a fresh server with a new domain. Based on 22 issues discovered during the first production deployment (see `deployment-guide.md`).

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Server | Ubuntu 22.04+ (ARM64 or AMD64), 4GB+ RAM, 20GB+ disk |
| Domain (platform) | e.g., `projectinworks.com` — hosts the Cloudify UI and its Convex backend |
| Domain (deployments) | e.g., `devhomelab.org` — wildcard domain for managed deployments (`*.devhomelab.org`) |
| Cloudflare account | For DNS management of the deployments domain (API token + zone ID needed) |
| DNS access | For the platform domain (can be any provider) |

---

## Current Deployment Process (Code Changes → Production)

For an already-running instance, pushing code changes:

```bash
# Single command — builds everything, syncs, deploys, restarts
./scripts/deploy.sh
```

What it does:

1. **Build** — `NEXT_PUBLIC_CONVEX_URL=<url> npx turbo build --force`
2. **Sync shared packages** — `packages/shared/dist/`, `packages/domain-manager/dist/`, `packages/docker-manager/dist/`
3. **Sync API** — `apps/api/dist/`
4. **Sync Web** — `apps/web/.next/` (contains baked-in `NEXT_PUBLIC_*` vars)
5. **Sync Convex functions** — `apps/convex/convex/` (source files)
6. **Sync config** — `cloudify.config.yml`
7. **Deploy Convex** — `npx convex deploy` on the server
8. **Restart PM2** — `pm2 restart ecosystem.config.cjs`

**Critical**: `NEXT_PUBLIC_CONVEX_URL` must be set at build time — it's baked into the client JS bundle. Runtime env vars (like `INFRA_AGENT_SECRET`) only need a PM2 restart.

**Critical**: When a shared package (`packages/shared`, `packages/domain-manager`) changes, its `dist/` must also be synced. The API imports these at runtime via workspace symlinks.

---

## Fresh Instance Setup

### Phase 1: Server Preparation

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Node via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2
npm install -g pm2

# Create deployment directory
sudo mkdir -p /opt/cloudify/deployments
sudo chown -R $USER:$USER /opt/cloudify
```

### Phase 2: Nginx Proxy Manager

```bash
mkdir -p ~/nginx-proxy-manager && cd ~/nginx-proxy-manager

cat > docker-compose.yml << 'EOF'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - npm_data:/data
      - npm_letsencrypt:/etc/letsencrypt
    networks:
      - npm-network
      - bridge

networks:
  npm-network:
    name: npm-network
    driver: bridge
  bridge:
    external: true

volumes:
  npm_data:
  npm_letsencrypt:
EOF

docker compose up -d
```

Default login: `admin@example.com` / `changeme` — change immediately at `http://<server-ip>:81`.

### Phase 3: iptables (Docker-to-Host Networking)

NPM runs in Docker but needs to reach PM2 services on the host. Without these rules, NPM gets "No route to host" for host ports.

```bash
# Allow Docker subnets to reach host ports
sudo iptables -I INPUT -s 172.17.0.0/16 -j ACCEPT
sudo iptables -I INPUT -s 172.25.0.0/16 -j ACCEPT
sudo iptables -I INPUT -s 172.26.0.0/16 -j ACCEPT

# Persist across reboots
sudo apt install -y netfilter-persistent
sudo netfilter-persistent save
```

### Phase 4: Copy Project & Install

```bash
# From local machine
rsync -avz --exclude node_modules --exclude .next --exclude dist --exclude .git \
  -e "ssh -i <ssh-key>" \
  /path/to/cloudify/ \
  user@<server-ip>:/opt/cloudify/app/

# On server
cd /opt/cloudify/app
bun install
```

### Phase 5: Configuration

#### 5.1 Generate Secrets

```bash
# INFRA_AGENT_SECRET
openssl rand -base64 30

# JWT key pair (for @convex-dev/auth)
node -e "
const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
jwk.alg = 'RS256';
jwk.use = 'sig';
jwk.kid = crypto.randomUUID();
console.log('JWT_PRIVATE_KEY:');
console.log(privateKey);
console.log('JWKS:');
console.log(JSON.stringify({ keys: [jwk] }));
"
```

#### 5.2 Create `.env`

```bash
cat > /opt/cloudify/app/.env << 'EOF'
# Cloudflare (for managing deployment domain DNS)
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ZONE_ID=<zone-id>
CLOUDFLARE_ACCOUNT_ID=<account-id>

# Nginx Proxy Manager
NPM_URL=http://localhost:81
NPM_EMAIL=<npm-admin-email>
NPM_PASSWORD=<npm-admin-password>

# Server
SERVER_IP=<server-public-ip>
BASE_DOMAIN=<deployments-domain>

# Cloudify's own Convex
CLOUDIFY_DB_PASSWORD=<generate-random>

# App
NEXT_PUBLIC_CONVEX_URL=https://convex.<platform-domain>
INFRA_AGENT_SECRET=<generated-secret>
INFRA_AGENT_URL=http://localhost:4000

# Auth (set via Convex HTTP API after backend starts — see Phase 7)
# JWT_PRIVATE_KEY=<set-via-api>
# JWKS=<set-via-api>
EOF
```

#### 5.3 Update `cloudify.config.yml`

Key values to change:

```yaml
server:
  serverIp: "<server-public-ip>"

domain:
  baseDomain: "<deployments-domain>"

cloudflare:
  apiToken: ""      # Overridden by .env
  zoneId: ""        # Overridden by .env
  proxied: false    # MUST be false — NPM handles SSL

nginxProxyManager:
  wildcardCertDomain: "<deployments-domain>"  # NO wildcard prefix — code adds *.

ports:
  rangeStart: 10210   # Avoid conflicts with any existing services
```

#### 5.4 Create `ecosystem.config.cjs`

```javascript
module.exports = {
  apps: [
    {
      name: "cloudify-api",
      cwd: "/opt/cloudify/app/apps/api",
      script: "/home/<user>/.bun/bin/bun",
      args: "run dist/index.js",
      env: {
        PORT: "4000",
        NODE_ENV: "production",
        INFRA_AGENT_SECRET: "<same-as-env>",
        CLOUDFLARE_API_TOKEN: "<token>",
        CLOUDFLARE_ZONE_ID: "<zone-id>",
        CLOUDFLARE_ACCOUNT_ID: "<account-id>",
        NPM_URL: "http://localhost:81",
        NPM_EMAIL: "<npm-email>",
        NPM_PASSWORD: "<npm-password>",
        SERVER_IP: "<server-ip>",
        BASE_DOMAIN: "<deployments-domain>",
      },
    },
    {
      name: "cloudify-web",
      cwd: "/opt/cloudify/app/apps/web",
      script: "/home/<user>/.bun/bin/bun",
      args: "run next start -p 3001",
      env: {
        PORT: "3001",
        NODE_ENV: "production",
        NEXT_PUBLIC_CONVEX_URL: "https://convex.<platform-domain>",
        INFRA_AGENT_SECRET: "<same-as-env>",
        INFRA_AGENT_URL: "http://localhost:4000",
      },
    },
  ],
};
```

**Critical**: Both `cloudify-api` AND `cloudify-web` need `INFRA_AGENT_SECRET`. The web app's proxy routes use it to authenticate with the API.

### Phase 6: Start Cloudify's Convex Backend

```bash
cd /opt/cloudify/app/docker
docker compose --env-file /opt/cloudify/app/.env -f docker-compose.cloudify.yml up -d

# Wait for healthy
docker compose -f docker-compose.cloudify.yml ps

# Deploy Convex schema and functions
cd /opt/cloudify/app/apps/convex
npx convex deploy --url http://localhost:3213

# Generate admin key
docker exec cloudify-convex ./generate_admin_key.sh
# Save this key — needed for future deploys and API access
```

### Phase 7: Set JWT Environment Variables

Convex function runtime does NOT read Docker container env vars. Auth keys must be set via the Convex HTTP API.

```bash
ADMIN_KEY="<admin-key-from-phase-6>"
CONVEX_URL="http://localhost:3213"

# Set JWT_PRIVATE_KEY (multiline PEM — cannot use CLI, must use HTTP API)
curl -X POST "$CONVEX_URL/api/update_environment_variables" \
  -H "Authorization: Convex $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"changes\":{\"JWT_PRIVATE_KEY\":\"$(cat /path/to/private.pem)\"}}"

# Set JWKS
curl -X POST "$CONVEX_URL/api/update_environment_variables" \
  -H "Authorization: Convex $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"changes\":{\"JWKS\":\"{\\\"keys\\\":[...]}\"}}"

# Set SITE_URL
curl -X POST "$CONVEX_URL/api/update_environment_variables" \
  -H "Authorization: Convex $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"changes\":{\"SITE_URL\":\"https://<platform-domain>\"}}"
```

**Gotchas**:
- `JWT_PRIVATE_KEY` must be raw PEM, NOT base64-encoded — `jose` library's `importPKCS8` expects the PEM string directly
- Multiline PEM breaks CLI args — must use HTTP API
- If you get "invalid RSA PrivateKey", regenerate the key pair on the server

### Phase 8: Build & Start Services

```bash
# Build on local machine with correct env
NEXT_PUBLIC_CONVEX_URL=https://convex.<platform-domain> npx turbo build --force

# Rsync to server (or use scripts/deploy.sh after updating it with new server details)
rsync -avz packages/shared/dist/ server:/opt/cloudify/app/packages/shared/dist/
rsync -avz packages/domain-manager/dist/ server:/opt/cloudify/app/packages/domain-manager/dist/
rsync -avz packages/docker-manager/dist/ server:/opt/cloudify/app/packages/docker-manager/dist/
rsync -avz apps/api/dist/ server:/opt/cloudify/app/apps/api/dist/
rsync -avz --delete apps/web/.next/ server:/opt/cloudify/app/apps/web/.next/

# On server — start services
cd /opt/cloudify/app
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

### Phase 9: DNS Records

#### Platform domain (e.g., `projectinworks.com`)

Create A records pointing to the server IP (DNS-only, NOT proxied):

| Record | Value |
|--------|-------|
| `<platform-domain>` | `<server-ip>` |
| `convex.<platform-domain>` | `<server-ip>` |
| `convex-site.<platform-domain>` | `<server-ip>` |

#### Deployments domain (e.g., `devhomelab.org`)

Managed automatically by Cloudify via Cloudflare API. No manual setup needed.

### Phase 10: NPM Proxy Hosts

#### 10.1 Create Wildcard Certificate (MANUAL — cannot be automated)

In NPM UI (`http://<server-ip>:81`):

1. **SSL Certificates** → **Add Let's Encrypt Certificate**
2. Domain: `*.<deployments-domain>`
3. Enable **Use a DNS Challenge**
4. DNS Provider: **Cloudflare**
5. Paste Cloudflare API token
6. Wait for provisioning

This step cannot be done via NPM API (v2 doesn't support DNS challenge certs).

#### 10.2 Create Platform Proxy Hosts

Create 3 proxy hosts for Cloudify itself:

| Domain | Forward To | WebSocket | Advanced Config |
|--------|-----------|-----------|-----------------|
| `<platform-domain>` | `172.17.0.1:3001` | No | — |
| `convex.<platform-domain>` | `172.17.0.1:3213` | Yes | `proxy_read_timeout 86400;` `proxy_buffering off;` |
| `convex-site.<platform-domain>` | `172.17.0.1:3214` | No | — |

**Critical**: Forward host must be `172.17.0.1` (Docker bridge gateway), NOT `127.0.0.1` (that's the container itself) or the public IP (causes redirect loops).

All proxy hosts should use the platform domain's SSL cert (create via NPM UI with HTTP challenge — straightforward) and have `ssl_forced: false`.

### Phase 11: Verify

1. `https://<platform-domain>` — Cloudify login page
2. `https://<platform-domain>/settings` — all status cards green (except wildcard cert if not yet created)
3. `https://<platform-domain>/system` — CPU, memory, disk, container stats
4. Create a test deployment → verify DNS records created, containers started, URLs accessible

---

## What Needs to Change Per Instance

| Item | Where | Notes |
|------|-------|-------|
| Server IP | `.env`, `cloudify.config.yml`, `ecosystem.config.cjs` | |
| Platform domain | `.env` (`NEXT_PUBLIC_CONVEX_URL`), `docker-compose.cloudify.yml` (`CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, `SITE_URL`), NPM proxy hosts, DNS | Requires web rebuild |
| Deployments domain | `.env` (`BASE_DOMAIN`), `cloudify.config.yml` (`baseDomain`, `wildcardCertDomain`), `ecosystem.config.cjs` | |
| Cloudflare credentials | `.env`, `ecosystem.config.cjs` | Different zone per domain |
| NPM credentials | `.env`, `ecosystem.config.cjs` | |
| INFRA_AGENT_SECRET | `.env`, `ecosystem.config.cjs` (both api AND web) | Generate unique per instance |
| JWT keys | Convex env vars (via HTTP API) | Generate unique per instance |
| Admin key | Generated by Convex backend | Unique per instance |
| Port range | `cloudify.config.yml`, `portAllocations.ts` | Avoid conflicts with existing services |
| SSH key path | `scripts/deploy.sh` | |

---

## Known Issues That Will Hit You

These are issues from the first deployment that will recur on any fresh setup:

### Always happens
1. **JWT_PRIVATE_KEY setup** — Must use HTTP API, not Docker env vars or CLI. PEM must be raw, not base64. (Issue 8)
2. **anyApi .js extension** — Self-hosted Convex requires `.js` in module paths. The patched `_generated/api.ts` handles this but do NOT let `npx convex deploy` overwrite it. (Issue 7)
3. **`NEXT_PUBLIC_*` requires rebuild** — Forgetting to set `NEXT_PUBLIC_CONVEX_URL` at build time = WebSocket to localhost. (Issue 12)
4. **Wildcard cert is manual** — NPM API can't create DNS challenge certs. (Issue 14)
5. **Forward host = Docker bridge gateway** — NPM forwards must use `172.17.0.1`, not localhost or public IP. The API auto-detects this now. (Issue 18)
6. **Shared packages must be synced** — Changing `packages/shared` requires syncing its `dist/` too. Use `scripts/deploy.sh`. (Issue 19)

### Likely happens
7. **iptables blocking Docker-to-host** — Ubuntu's default iptables reject Docker subnet traffic. (Issue 6)
8. **Cloudflare DNS must be DNS-only** — Proxied records + NPM SSL = redirect loop. (Issue 17)
9. **Container name conflicts** — Deployment names that match existing containers will fail. (Issue 22)
10. **Port conflicts** — `PORT_RANGE_START` in `portAllocations.ts` is hardcoded. Must match actual available ports. (Issue 16)

---

## What's Needed for Full Automation

| Gap | Current State | Solution |
|-----|--------------|----------|
| Wildcard cert | Manual via NPM UI | Switch to Caddy or Traefik (built-in ACME DNS challenge) |
| Server setup | Manual SSH commands | Cloud-init script or Ansible playbook |
| Instance config | Edit 5+ files manually | Interactive `scripts/setup.sh` that generates all configs |
| Deploys | `scripts/deploy.sh` (manual trigger) | GitHub Actions CI/CD on push to main |
| Multi-server | Single server only | Remote infra agent support + server registry |
| Domain onboarding | Hardcoded single domain | Domain management UI + per-domain cert provisioning |
| Port allocation | Hardcoded range, no host-level check | Query Docker for actually-used ports before allocating |
| Container naming | `{name}-postgres-db` can conflict | Namespace: `cloudify-{name}-postgres-db` |
| Health monitoring | None after initial deploy | Periodic health checks + alerting |
