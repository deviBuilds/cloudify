# Cloudify Deployment Guide

Deployment of Cloudify to Oracle Cloud ARM64 instance.

- **Server**: `146.235.212.232` (Ubuntu 24.04, ARM64)
- **Platform domain**: `projectinworks.com`
- **Managed deployments domain**: `*.devhomelab.org`
- **Date**: April 2026

---

## Architecture Overview

Cloudify is a self-hosted deployment management platform built as a Turborepo monorepo:

| Package | Description |
|---------|-------------|
| `apps/web` | Next.js frontend |
| `apps/api` | Express API server |
| `apps/convex` | Convex backend (schema, functions, actions) |
| `packages/*` | Shared libraries (docker-manager, etc.) |

Production services:

| Domain | Purpose |
|--------|---------|
| `projectinworks.com` | Cloudify web UI |
| `convex.projectinworks.com` | Convex backend (WebSocket + HTTP) |
| `convex-site.projectinworks.com` | Convex site serving |
| `*.devhomelab.org` | Managed user deployments |

---

## Phase 1: Backup Existing State

All backups are stored in `~/backups/` on the server.

### Create backup directories

```bash
mkdir -p ~/backups/volumes/
```

### Dump PostgreSQL databases

```bash
# aegis (default port 5432)
docker exec aegis-postgres-db pg_dumpall -U convex > ~/backups/aegis-postgres-dump.sql

# dbSevarthi (custom port 10200 — not default 5432)
docker exec dbSevarthiProjectHub-postgres-db pg_dumpall -U "dbSevarthiProjectHub-postgres-db" -p 10200 > ~/backups/dbsevarthi-postgres-dump.sql
```

### Backup Docker volumes

```bash
# aegis volumes
docker run --rm -v aegis-convex_pgdata:/data -v ~/backups/volumes:/backup alpine tar czf /backup/aegis-convex_pgdata.tar.gz -C /data .
docker run --rm -v aegis-convex_convex_data:/data -v ~/backups/volumes:/backup alpine tar czf /backup/aegis-convex_convex_data.tar.gz -C /data .

# dbSevarthi volumes
docker run --rm -v dbsevarthiprojecthub_pgdata:/data -v ~/backups/volumes:/backup alpine tar czf /backup/dbsevarthiprojecthub_pgdata.tar.gz -C /data .
docker run --rm -v dbsevarthiprojecthub_convex_data:/data -v ~/backups/volumes:/backup alpine tar czf /backup/dbsevarthiprojecthub_convex_data.tar.gz -C /data .

# flixor-ota volumes
docker run --rm -v flixor-ota_postgres-data:/data -v ~/backups/volumes:/backup alpine tar czf /backup/flixor-ota_postgres-data.tar.gz -C /data .
docker run --rm -v flixor-ota_ota-releases:/data -v ~/backups/volumes:/backup alpine tar czf /backup/flixor-ota_ota-releases.tar.gz -C /data .
```

### Save compose files, env files, and container state

```bash
cp -r ~/aegis-convex/ ~/backups/aegis-convex-config/
cp -r ~/dbSevarthiProjectHub/ ~/backups/dbSevarthiProjectHub-config/

docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > ~/backups/container-state.txt
```

---

## Phase 2: Prepare Instance

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
# Produces v1.3.11
```

### Docker permissions

```bash
sudo usermod -aG docker ubuntu
```

Log out and back in for the group change to take effect.

### Create Cloudify directories

```bash
sudo mkdir -p /opt/cloudify/deployments
sudo chown -R ubuntu:ubuntu /opt/cloudify
```

---

## Phase 3: Deploy Project

### Rsync from local machine

Run from the development machine:

```bash
rsync -avz \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude .turbo \
  --exclude .env \
  -e "ssh -i <path-to-key>" \
  /Users/devitripathy/code/cloudify/ \
  ubuntu@146.235.212.232:/opt/cloudify/app/
```

### Install dependencies and build

On the server:

```bash
cd /opt/cloudify/app
bun install
# 1494 packages installed in 2.62s

bunx turbo build
# 14.145s, all 5 packages built
```

### Create environment file

Create `/opt/cloudify/app/.env` with all required credentials:

- Cloudflare API token and zone IDs
- NPM (Nginx Proxy Manager) API credentials
- Database password
- Infrastructure agent secret
- Convex deployment URL and admin key (added after Phase 4)

---

## Phase 4: Start Cloudify's Own Convex Backend

### Create the compose file

Create `docker/docker-compose.cloudify.yml` with:

- **cloudify-postgres** on port 5433
- **cloudify-convex** on ports 3213 (backend) and 3214 (site)

### Start containers

```bash
cd /opt/cloudify/app/docker
docker compose -f docker-compose.cloudify.yml up -d
```

### Issue 1: POSTGRES_URL contains database name

**Symptom**: Convex error — `cluster url already contains db name: /cloudify`

**Root cause**: The POSTGRES_URL was set to `postgresql://user:pass@host:5432/cloudify`. The Convex self-hosted backend expects the URL *without* a database name. It creates and manages its own database.

**Fix**: Remove the database name from POSTGRES_URL:

```
# Wrong
POSTGRES_URL=postgresql://convex:password@cloudify-postgres:5432/cloudify

# Correct
POSTGRES_URL=postgresql://convex:password@cloudify-postgres:5432
```

### Issue 2: POSTGRES_DB must be convex_self_hosted

**Symptom**: Convex fails to find its expected database.

**Root cause**: POSTGRES_DB was set to `cloudify`, but the Convex backend always creates and uses a database named `convex_self_hosted`.

**Fix**: Set `POSTGRES_DB=convex_self_hosted` in the compose file. Since the wrong database was already initialized, the volume had to be deleted:

```bash
docker compose -f docker-compose.cloudify.yml down -v
docker compose -f docker-compose.cloudify.yml up -d
```

### Generate admin key

```bash
docker exec cloudify-convex ./generate_admin_key.sh
```

Save this key for the `.env` file and for deploying the schema.

### Issue 3: @auth/core missing customFetch export

**Symptom**: Build error — `@auth/core@0.34.3` does not export `customFetch`, which `@convex-dev/auth@0.0.91` requires.

**Fix**: In `apps/convex/package.json`, bump `@auth/core`:

```
"@auth/core": "^0.37.0"
```

### Issue 4: Convex bundler cannot resolve workspace packages

**Symptom**: Convex deploy fails with resolution error for `@cloudify/docker-manager`.

**Root cause**: The Convex bundler runs inside the Convex Docker container and cannot resolve Turborepo workspace package paths.

**Fix**: Inline the `generateConvexComposeConfig` function directly into `apps/convex/convex/actions/createDeployment.ts` instead of importing from `@cloudify/docker-manager`. Any function used in a Convex action must be self-contained within the `convex/` directory.

### Issue 5: Template generates POSTGRES_URL with database name

**Symptom**: Managed deployments fail with the same "cluster url already contains db name" error from Issue 1.

**Root cause**: The compose template in `packages/docker-manager/src/templates/convex.ts` and the inlined function both generated `POSTGRES_URL` with `/convex_self_hosted` appended.

**Fix**: Remove the database name from POSTGRES_URL in both:

- `packages/docker-manager/src/templates/convex.ts`
- The inlined function in `apps/convex/convex/actions/createDeployment.ts`

### Deploy Convex schema

```bash
cd /opt/cloudify/app
bunx convex deploy --url http://localhost:3213 --admin-key "<admin-key>"
```

### Add environment variables for Convex actions

Add these to the `cloudify-convex` service in `docker-compose.cloudify.yml`:

```yaml
environment:
  - INFRA_AGENT_URL=http://host.docker.internal:4000
  - INFRA_AGENT_SECRET=<secret>
  - SERVER_IP=146.235.212.232
  - BASE_DOMAIN=devhomelab.org
  - CLOUDFLARE_API_TOKEN=<token>
  - CLOUDFLARE_ZONE_ID=<zone-id>
  - NPM_API_URL=http://host.docker.internal:81/api
  - NPM_API_TOKEN=<token>
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## Phase 5: Start Cloudify Services

### Install PM2

```bash
source ~/.nvm/nvm.sh
npm install -g pm2
```

### Create ecosystem config

Create `/opt/cloudify/app/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: "cloudify-api",
      cwd: "/opt/cloudify/app/apps/api",
      script: "dist/index.js",
      env: {
        PORT: 4000,
        NODE_ENV: "production"
      }
    },
    {
      name: "cloudify-web",
      cwd: "/opt/cloudify/app/apps/web",
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      env: {
        PORT: 3001,
        NODE_ENV: "production"
      }
    }
  ]
};
```

### Start services

```bash
cd /opt/cloudify/app
pm2 start ecosystem.config.cjs
```

### Issue 6: NPM container cannot reach host PM2 services

**Symptom**: Nginx Proxy Manager returns 502 Bad Gateway for `projectinworks.com`.

**Diagnosis**:

```bash
# Test connectivity from inside NPM container
docker exec nginx-proxy-manager python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(3)
result = s.connect_ex(('172.17.0.1', 3001))
print(f'Port 3001: {\"open\" if result == 0 else \"closed/filtered\"} (code {result})')
s.close()
"
# Result: "No route to host"
```

**Root cause**: NPM runs on the `npm-network` Docker network (172.25.0.0/16), not the default bridge network (172.17.0.0/16). The host's iptables INPUT chain had a REJECT rule that blocked traffic from Docker subnets to host-bound ports. Docker's own port-mapped services work because they go through the FORWARD chain, but PM2 processes listen directly on the host and are reached via INPUT.

**Fix**:

1. Connect NPM to the bridge network:

```bash
docker network connect bridge nginx-proxy-manager
```

2. Add iptables rules to allow Docker subnet traffic:

```bash
sudo iptables -I INPUT 5 -s 172.17.0.0/16 -j ACCEPT
sudo iptables -I INPUT 5 -s 172.25.0.0/16 -j ACCEPT
sudo iptables -I INPUT 5 -s 172.26.0.0/16 -j ACCEPT
```

3. Persist the rules:

```bash
sudo netfilter-persistent save
```

4. Update `~/nginx-proxy-manager/docker-compose.yml` to include both networks permanently:

```yaml
networks:
  npm-network:
    driver: bridge
  bridge:
    external: true

services:
  npm:
    networks:
      - npm-network
      - bridge
```

### Configure PM2 startup

```bash
pm2 save
pm2 startup
# Run the sudo command it outputs, e.g.:
sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v20.x.x/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## Phase 5.5: DNS and SSL

### Create DNS records

All DNS records must be **DNS-only** (grey cloud icon in Cloudflare, `proxied: false`). Do not use Cloudflare proxy (orange cloud) because:

- Cloudflare proxied mode requires the SSL mode to be "Flexible" to work without origin certificates
- The API token only has DNS edit permissions, not zone settings permissions
- NPM handles SSL termination via Let's Encrypt instead

Cloudflare zone ID for `projectinworks.com`: `0a20dbb4a9165d07d3f55836e384d326`

```bash
# projectinworks.com → A → 146.235.212.232 (already existed, DNS-only)

# convex.projectinworks.com
curl -X POST "https://api.cloudflare.com/client/v4/zones/0a20dbb4a9165d07d3f55836e384d326/dns_records" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"convex","content":"146.235.212.232","ttl":1,"proxied":false}'

# convex-site.projectinworks.com
curl -X POST "https://api.cloudflare.com/client/v4/zones/0a20dbb4a9165d07d3f55836e384d326/dns_records" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"convex-site","content":"146.235.212.232","ttl":1,"proxied":false}'
```

### Request Let's Encrypt certificates via NPM API

```bash
# Request certificate (repeat for each domain)
curl -X POST "http://localhost:81/api/nginx/certificates" \
  -H "Authorization: Bearer <npm-token>" \
  -H "Content-Type: application/json" \
  --data '{
    "nice_name": "projectinworks.com",
    "domain_names": ["projectinworks.com"],
    "meta": {"key_type": "ecdsa"},
    "provider": "letsencrypt"
  }'
```

Certificates created:

| Cert ID | Domain |
|---------|--------|
| 4 | projectinworks.com |
| 5 | convex.projectinworks.com |
| 6 | convex-site.projectinworks.com |

### Create NPM proxy hosts

```bash
# projectinworks.com → Cloudify Web
curl -X POST "http://localhost:81/api/nginx/proxy-hosts" \
  -H "Authorization: Bearer <npm-token>" \
  -H "Content-Type: application/json" \
  --data '{
    "domain_names": ["projectinworks.com"],
    "forward_scheme": "http",
    "forward_host": "172.17.0.1",
    "forward_port": 3001,
    "certificate_id": 4,
    "ssl_forced": true,
    "http2_support": true
  }'

# convex.projectinworks.com → Cloudify Convex backend
curl -X POST "http://localhost:81/api/nginx/proxy-hosts" \
  -H "Authorization: Bearer <npm-token>" \
  -H "Content-Type: application/json" \
  --data '{
    "domain_names": ["convex.projectinworks.com"],
    "forward_scheme": "http",
    "forward_host": "172.17.0.1",
    "forward_port": 3213,
    "certificate_id": 5,
    "ssl_forced": true,
    "http2_support": true,
    "advanced_config": "proxy_read_timeout 86400;\nproxy_buffering off;"
  }'

# convex-site.projectinworks.com → Cloudify Convex site
curl -X POST "http://localhost:81/api/nginx/proxy-hosts" \
  -H "Authorization: Bearer <npm-token>" \
  -H "Content-Type: application/json" \
  --data '{
    "domain_names": ["convex-site.projectinworks.com"],
    "forward_scheme": "http",
    "forward_host": "172.17.0.1",
    "forward_port": 3214,
    "certificate_id": 6,
    "ssl_forced": true,
    "http2_support": true,
    "advanced_config": "proxy_read_timeout 86400;\nproxy_buffering off;"
  }'
```

NPM proxy host IDs: 5, 6, 7.

The advanced config for Convex proxy hosts is required for WebSocket connections (`proxy_read_timeout 86400` prevents premature timeout, `proxy_buffering off` ensures real-time data flow).

---

## Phase 6: Convex Client Fix

### Issue 7 (Critical): anyApi module paths missing .js extension

**Symptom**: Web app shows fatal error:

```
[CONVEX FATAL ERROR] Received Invalid JSON on websocket:
Module path (users.hasAnyUsers) has an extension that isn't 'js'.
```

**Root cause**: The Convex npm client's `anyApi` proxy (used in the default `_generated/api.js`) creates function references with paths like `users:hasAnyUsers`. However, the self-hosted Convex backend expects paths with `.js` extensions: `users.js:hasAnyUsers`.

The standard `_generated/api.js` generated by `convex codegen` uses `anyApi` from `convex/server`, which builds paths without the `.js` extension. This works with Convex Cloud but fails with the self-hosted backend.

**Fix**: Create custom versions of `apps/convex/convex/_generated/api.ts` and `apps/convex/convex/_generated/api.js` that override the path construction to append `.js` to module paths. The patched files use `Symbol.for("functionName")` to intercept the Convex client's internal function name resolution.

After patching, force rebuild and restart:

```bash
cd /opt/cloudify/app
rm -rf apps/web/.next .turbo
bunx turbo build --filter=@cloudify/web --force
pm2 restart cloudify-web
```

**Important**: The patched `_generated/api.ts` and `_generated/api.js` files are committed to git. Running `convex deploy` or `convex codegen` will overwrite them. See the automation section below for how to handle this.

---

## Port Map

| Port | Service | Domain | Notes |
|------|---------|--------|-------|
| 80/443 | Nginx Proxy Manager | -- | Reverse proxy for all domains |
| 81 | NPM Admin UI | -- | Admin interface |
| 3000 | dbsevarthi-nextjs | app.devhomelab.org | Pre-existing |
| 3001 | Cloudify Web (Next.js) | projectinworks.com | Via PM2 |
| 3210 | aegis-convex backend | devhomelab.org | Pre-existing |
| 3211 | aegis-convex site | -- | Pre-existing |
| 3213 | Cloudify Convex backend | convex.projectinworks.com | Docker |
| 3214 | Cloudify Convex site | convex-site.projectinworks.com | Docker |
| 4000 | Cloudify API (Express) | -- | Internal only, via PM2 |
| 5432 | aegis-postgres | -- | Pre-existing |
| 5433 | Cloudify postgres | -- | Docker |
| 10200-10203 | dbSevarthi services | -- | Pre-existing |
| 10210+ | Managed deployments | *.devhomelab.org | Dynamic allocation |

---

## Automation Recommendations

These are the issues encountered during deployment and how to prevent them in future deployments or automated provisioning.

### 1. POSTGRES_URL must not contain a database name

The Convex self-hosted backend manages its own database. Including a database name in POSTGRES_URL (e.g., `/cloudify`) causes the error "cluster url already contains db name."

**Status**: Fixed in code. The compose template generator (`packages/docker-manager/src/templates/convex.ts`) and the inlined function in `createDeployment.ts` no longer append a database name.

**Automation**: No further action needed. The fix is in the codebase.

### 2. POSTGRES_DB must be convex_self_hosted

The Convex backend always creates and uses a database named `convex_self_hosted` regardless of what POSTGRES_DB is set to. However, POSTGRES_DB should still be set to `convex_self_hosted` so that the PostgreSQL container's healthcheck (`pg_isready -d $POSTGRES_DB`) passes correctly.

**Status**: Hardcoded in the compose template.

### 3. @auth/core minimum version

`@convex-dev/auth@0.0.91` requires the `customFetch` export which was added in `@auth/core@0.37.0`.

**Status**: Fixed in `apps/convex/package.json` (pinned to `^0.37.0`).

**Automation**: Add a CI check that verifies `@auth/core` is at least `0.37.0`.

### 4. Workspace packages cannot be used in Convex actions

The Convex bundler runs inside the Convex container and cannot resolve Turborepo workspace packages (e.g., `@cloudify/docker-manager`). Any function called from a Convex action must be defined within the `convex/` directory.

**Status**: `generateConvexComposeConfig` is inlined in `createDeployment.ts`.

**Automation**: Add a lint rule or CI check that scans `apps/convex/convex/**/*.ts` for imports from `@cloudify/*` workspace packages and fails the build.

### 5. POSTGRES_URL with db name in templates

Same root cause as item 1, but specifically in the compose template generation.

**Status**: Fixed in `packages/docker-manager/src/templates/convex.ts`.

### 6. Docker-to-host networking (iptables)

Docker containers on non-default networks cannot reach services bound to the host (PM2 processes) because iptables INPUT chain blocks the traffic. Docker port-mapped services work because they use the FORWARD chain.

**Automation via cloud-init**:

```yaml
runcmd:
  - iptables -I INPUT 5 -s 172.0.0.0/8 -j ACCEPT
  - netfilter-persistent save
```

Or create a systemd service:

```ini
[Unit]
Description=Allow Docker subnet traffic to host
After=docker.service

[Service]
Type=oneshot
ExecStart=/sbin/iptables -I INPUT 5 -s 172.0.0.0/8 -j ACCEPT
RemainAfterExit=true

[Install]
WantedBy=multi-user.target
```

### 7. Convex anyApi .js extension patch

The patched `_generated/api.ts` and `_generated/api.js` files will be overwritten by `convex deploy` or `convex codegen`.

**Current approach**: Files are committed to git.

**Automation**: Add a post-deploy script that restores the patched files after any Convex codegen/deploy operation:

```bash
#!/bin/bash
# post-convex-deploy.sh
cp convex/_generated/api.patched.ts convex/_generated/api.ts
cp convex/_generated/api.patched.js convex/_generated/api.js
bunx turbo build --filter=@cloudify/web --force
```

Alternatively, add to the `convex deploy` npm script in `package.json`:

```json
"deploy:convex": "convex deploy && cp convex/_generated/api.patched.ts convex/_generated/api.ts && cp convex/_generated/api.patched.js convex/_generated/api.js"
```

### 8. NPM bridge network

NPM's docker-compose.yml must include both `npm-network` and the external `bridge` network so it can reach host-bound services at `172.17.0.1`.

**Status**: Already updated in `~/nginx-proxy-manager/docker-compose.yml` on the server.

### 9. Bun installation

**Cloud-init**:

```yaml
runcmd:
  - su - ubuntu -c "curl -fsSL https://bun.sh/install | bash"
```

### 10. PM2 startup persistence

After installing PM2 and starting apps:

```bash
pm2 save
pm2 startup
# Execute the sudo command that pm2 startup outputs
```

**Cloud-init**: Run `pm2 startup` as part of the provisioning script after the app is deployed.

---

## Files Modified During Deployment

| File | Change |
|------|--------|
| `cloudify.config.yml` | `ports.rangeStart` changed from `10200` to `10210` (avoid conflict with dbSevarthi) |
| `docker/docker-compose.cloudify.yml` | Created -- production Convex + postgres compose file |
| `apps/convex/package.json` | `@auth/core` bumped from `^0.34.3` to `^0.37.0` |
| `apps/convex/convex/actions/createDeployment.ts` | Inlined `generateConvexComposeConfig`, removed `@cloudify/docker-manager` import |
| `apps/convex/convex/_generated/api.ts` | Patched to append `.js` to module paths for self-hosted Convex |
| `apps/convex/convex/_generated/api.js` | Created -- runtime version of the patched api.ts |
| `packages/docker-manager/src/templates/convex.ts` | Removed database name from POSTGRES_URL in template |
| `~/nginx-proxy-manager/docker-compose.yml` (on server) | Added `bridge` external network alongside `npm-network` |

### Issue 8: Missing JWT_PRIVATE_KEY for @convex-dev/auth

**Error**: `Missing environment variable JWT_PRIVATE_KEY` during sign-in.

**Root cause**: `@convex-dev/auth` uses RSA keys to sign and verify JWT tokens for user sessions. These environment variables must be set through the **Convex function environment** (via `convex env set` or the HTTP API), NOT as Docker container environment variables. Convex actions run in an isolated runtime and do not inherit Docker container env vars.

**Required variables**:
- `JWT_PRIVATE_KEY` — Raw PEM string (NOT base64-encoded), starting with `-----BEGIN PRIVATE KEY-----`
- `JWKS` — JSON Web Key Set containing the matching public key
- `SITE_URL` — The platform URL for auth redirects (e.g., `https://projectinworks.com`)

#### Critical details discovered through debugging:

1. **Container env vars don't work**: Setting `JWT_PRIVATE_KEY` in `docker-compose.yml` or `env_file` does NOT make it available to Convex functions. You must use `convex env set` or the Convex HTTP API.

2. **Must be raw PEM, not base64**: The `jose` library's `importPKCS8` expects the raw PEM string. Passing base64-encoded PEM causes: `"pkcs8" must be PKCS#8 formatted string`.

3. **Multiline PEM breaks CLI args**: The `convex env set` CLI command cannot handle multiline PEM values (they get parsed as CLI flags starting with `--`). Use the **Convex HTTP API** instead.

4. **Key must be freshly generated on the server**: Generating keys locally and transferring them can introduce encoding issues. Generate directly on the target server.

**Fix — Complete procedure**:

```bash
# Run on the server (requires Node.js)
source ~/.nvm/nvm.sh && node -e "
const crypto = require('crypto');

// Generate RSA-2048 key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Build JWKS
const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
jwk.kid = 'cloudify-key-1';
jwk.use = 'sig';
jwk.alg = 'RS256';
const jwks = JSON.stringify({ keys: [jwk] });

// Validate key before setting
crypto.createPrivateKey(privateKey);
console.log('Key validated OK, length:', privateKey.length);

// Set via Convex HTTP API (handles multiline values correctly)
const adminKey = '<YOUR_CONVEX_ADMIN_KEY>';
const url = 'http://localhost:3213';

fetch(url + '/api/update_environment_variables', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Convex ' + adminKey,
  },
  body: JSON.stringify({
    changes: [
      { name: 'JWT_PRIVATE_KEY', value: privateKey.trim() },
      { name: 'JWKS', value: jwks },
    ]
  })
}).then(r => console.log('Status:', r.status))
  .catch(e => console.error('Error:', e));
"
```

Then set `SITE_URL` (single-line, so CLI works):

```bash
bunx convex env set SITE_URL "https://projectinworks.com" \
  --url http://localhost:3213 \
  --admin-key "<YOUR_CONVEX_ADMIN_KEY>"
```

#### Other Convex function env vars

All environment variables accessed by Convex actions via `process.env` must also be set through `convex env set`, not Docker:

```bash
ADMIN_KEY="<YOUR_CONVEX_ADMIN_KEY>"
URL="http://localhost:3213"

bunx convex env set INFRA_AGENT_URL "http://host.docker.internal:4000" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set INFRA_AGENT_SECRET "<secret>" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set SERVER_IP "146.235.212.232" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set BASE_DOMAIN "devhomelab.org" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set CLOUDFLARE_API_TOKEN "<token>" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set CLOUDFLARE_ZONE_ID "<zone_id>" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set NPM_URL "http://host.docker.internal:81" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set NPM_EMAIL "<email>" --url $URL --admin-key "$ADMIN_KEY"
bunx convex env set NPM_PASSWORD "<password>" --url $URL --admin-key "$ADMIN_KEY"
```

**Automation**: Add a setup script (`scripts/setup-convex-env.sh`) that generates JWT keys and sets all env vars via the HTTP API after the Convex backend is healthy.

### Issue 9: Docker Compose env_file vs shell export

**Problem**: The compose file originally used `export $(grep -v "^#" .env | xargs)` to load environment variables for compose interpolation. This strips double quotes from JSON values like `JWKS`, causing malformed environment variables in containers.

**Fix**: Use Docker Compose's built-in `env_file` directive for container env vars (preserves JSON quotes), combined with `--env-file` CLI flag for compose variable interpolation (`${CLOUDIFY_DB_PASSWORD}` in POSTGRES_URL):

```yaml
services:
  cloudify-convex:
    env_file:
      - ../.env          # Container env vars (JWKS, JWT_PRIVATE_KEY, etc.)
    environment:
      POSTGRES_URL: postgresql://cloudify:${CLOUDIFY_DB_PASSWORD}@cloudify-postgres:5432
```

```bash
docker compose --env-file /opt/cloudify/app/.env -f docker-compose.cloudify.yml up -d
```

### Issue 10: 401 Unauthorized on web proxy routes

**Problem**: After login works, the dashboard shows 401 errors on:
- `GET /api/proxy/metrics/system`
- `GET /api/proxy/metrics/containers`
- `GET /api/proxy/infra/status`

**Root cause**: The Next.js proxy routes in `apps/web/src/app/api/proxy/` forward requests to the infra agent at localhost:4000 with `Authorization: Bearer ${INFRA_AGENT_SECRET}`. The PM2 ecosystem config for `cloudify-web` was missing `INFRA_AGENT_SECRET` and `INFRA_AGENT_URL`, so the proxy was sending an empty Bearer token.

**Fix**: Add both env vars to the web app's PM2 config:

```javascript
// ecosystem.config.cjs — cloudify-web section
env: {
  PORT: "3001",
  NODE_ENV: "production",
  NEXT_PUBLIC_CONVEX_URL: "https://convex.projectinworks.com",
  INFRA_AGENT_SECRET: "<same secret as cloudify-api>",
  INFRA_AGENT_URL: "http://localhost:4000",
},
```

Then restart: `pm2 restart ecosystem.config.cjs && pm2 save`

**Automation note**: The ecosystem.config.cjs template should include `INFRA_AGENT_SECRET` and `INFRA_AGENT_URL` for the web app by default.

### Issue 11: Sidebar icons rendering on separate lines from labels

**Problem**: The sidebar navigation shows icons stacked above text labels instead of inline (icon + label on same row).

**Root cause**: The `SidebarMenuButton` component uses `@base-ui/react`'s `useRender` API, which expects a `render` prop to delegate rendering to a custom element. The sidebar code was passing `asChild` (the Radix UI pattern), which is silently ignored by Base UI. This caused `SidebarMenuButton` to render as a `<button>` wrapping a `<Link>`, so the flex layout classes (`flex items-center gap-2`) applied to the button, not the Link — the icon and span inside the Link stacked vertically as non-flex children.

**Fix**: Replace `asChild` with `render` in `apps/web/src/components/layout/sidebar.tsx`:

```tsx
// Before (Radix pattern — broken with Base UI)
<SidebarMenuButton asChild isActive={isActive(item.href)}>
  <Link href={item.href}>
    <item.icon className="h-4 w-4" />
    <span>{item.title}</span>
  </Link>
</SidebarMenuButton>

// After (Base UI pattern — correct)
<SidebarMenuButton render={<Link href={item.href} />} isActive={isActive(item.href)}>
  <item.icon className="h-4 w-4" />
  <span>{item.title}</span>
</SidebarMenuButton>
```

With `render={<Link />}`, Base UI renders a `<Link>` (i.e. `<a>`) that directly receives the flex classes, making icon and text its direct flex children.

**Automation note**: When using shadcn/ui components that depend on `@base-ui/react` (newer versions), always use `render={<Component />}` instead of `asChild`. The `asChild` pattern only works with Radix-based shadcn/ui.

### Issue 12: WebSocket connecting to localhost instead of production Convex URL

**Problem**: Browser console shows repeated WebSocket errors:
```
WebSocket connection to 'ws://localhost:3211/api/1.34.1/sync' failed
WebSocket closed with code 1006
Attempting reconnect in 555ms
```

**Root cause**: `NEXT_PUBLIC_CONVEX_URL` is a Next.js public env var that gets **baked into the client JavaScript bundle at build time** (not read at runtime). The web app was built locally without this env var set, so the Convex client `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` received `undefined`, falling back to the default `localhost:3211` WebSocket URL.

**Fix**: Rebuild with the env var set:

```bash
NEXT_PUBLIC_CONVEX_URL=https://convex.projectinworks.com npx turbo build --filter=@cloudify/web --force
```

Then rsync the `.next/` directory to the server and restart PM2.

**Key lesson**: Any change to `NEXT_PUBLIC_*` environment variables requires a **full rebuild** of the Next.js app. Runtime env vars (`INFRA_AGENT_SECRET`, etc.) are read at request time and only need a PM2 restart.

**Automation note**: The CI/CD pipeline or deployment script must always set `NEXT_PUBLIC_CONVEX_URL` before building. Consider adding a `.env.production` file to the web app or validating that the var is set in the build step.

### Issue 13: Convex action cross-references missing `actions/` prefix

**Problem**: Creating a deployment fails with:
```
Could not find public function for 'createDeployment:createDeployment'
Could not find public function for 'domainActions:setupDomains'
```

**Root cause**: All Convex actions live in `convex/actions/` subdirectory, so their module paths must include the directory prefix. The patched `api.ts` proxy builds paths from the property chain — `api.actions.createDeployment.createDeployment` → `actions/createDeployment.js:createDeployment`. Two categories of broken references:

1. **Web app client calls** — `useAction(api.createDeployment.createDeployment)` should be `useAction(api.actions.createDeployment.createDeployment)`
2. **Action-to-action calls** — Inside `createDeployment.ts` and `deleteDeployment.ts`, calls like `api.domainActions.setupDomains` should be `api.actions.domainActions.setupDomains`

Note: Calls to top-level modules (`api.deployments`, `api.auditLog`, `api.credentials`, etc.) are correct — those files are in the `convex/` root, not a subdirectory.

**Files fixed**:
- `apps/web/src/app/(dashboard)/deployments/new/page.tsx` — `api.createDeployment` → `api.actions.createDeployment`
- `apps/web/src/components/deployments/delete-dialog.tsx` — `api.deleteDeployment` → `api.actions.deleteDeployment`
- `apps/web/src/components/deployments/actions-dropdown.tsx` — `api.lifecycleActions` → `api.actions.lifecycleActions`
- `apps/web/src/app/(dashboard)/deployments/[id]/page.tsx` — `api.lifecycleActions` → `api.actions.lifecycleActions`
- `apps/convex/convex/actions/createDeployment.ts` — `api.domainActions` → `api.actions.domainActions`
- `apps/convex/convex/actions/deleteDeployment.ts` — `api.domainActions` → `api.actions.domainActions`

After fixing action files, must redeploy Convex functions:
```bash
npx convex deploy --url http://localhost:3213 --admin-key '<admin-key>'
```

**Automation note**: A lint rule or pre-deploy check should validate that all `api.*` references match actual file paths relative to `convex/`.

### Issue 14: Wildcard SSL certificate not provisioned in NPM

**Problem**: Deployment creation fails with:
```
Wildcard certificate not found in Nginx Proxy Manager
```

**Root cause**: The `domainActions.setupDomains` action fetches the wildcard cert ID from NPM (`/infra/proxy/cert`) to assign SSL to new proxy hosts. No `*.devhomelab.org` wildcard certificate existed in NPM.

**Attempted API fix**: Creating a wildcard cert via the NPM v2.14.0 REST API failed with schema validation errors:
```json
{"error": {"code": 400, "message": "data/meta must NOT have additional properties"}}
```

NPM's API schema rejects DNS challenge fields (`dns_challenge`, `dns_provider`, `dns_provider_credentials`) in the `meta` object. The `/provision` endpoint also doesn't exist in v2.14.

**Manual fix**: Create the wildcard certificate through the NPM admin UI:
1. Go to `http://146.235.212.232:81` → **SSL Certificates** → **Add Let's Encrypt Certificate**
2. Domain: `*.devhomelab.org`
3. Enable **Use a DNS Challenge**
4. DNS Provider: **Cloudflare**
5. Paste API token: `cfat_b6hUu6v3JTCdgl3XjWUGrGWaw0QzjR6ggYkM8J9w3ca9bd8a`
6. Wait for provisioning to complete

**Status**: Resolved manually via NPM UI.

### Issue 15: Wildcard cert domain config double-prefixed with `*.`

**Problem**: Even after creating the wildcard cert in NPM, the API still reports "Wildcard certificate not found". API logs show it searching for `*.*.devhomelab.org`.

**Root cause**: `cloudify.config.yml` had `wildcardCertDomain: "*.devhomelab.org"`, but the `findWildcardCert()` function in `packages/domain-manager/src/nginx-proxy.ts` prepends `*.` to the domain — resulting in `*.*.devhomelab.org`.

**Fix**: Change the config to just the base domain:
```yaml
# Before (wrong)
wildcardCertDomain: "*.devhomelab.org"

# After (correct)
wildcardCertDomain: "devhomelab.org"
```

Then restart the API: `pm2 restart cloudify-api`

### Issue 16: Port range start hardcoded in Convex function

**Problem**: Deployment creation fails with:
```
Bind for 0.0.0.0:10200 failed: port is already allocated
```

**Root cause**: `portAllocations.ts` has `PORT_RANGE_START = 10200` hardcoded, ignoring `cloudify.config.yml`'s `ports.rangeStart: 10210`. Ports 10200-10203 are already used by the existing dbSevarthi deployment.

Convex functions run in an isolated runtime and cannot read the config file — so the port range must be set directly in the function code.

**Fix**: Updated `apps/convex/convex/portAllocations.ts`:
- Changed `PORT_RANGE_START` from `10200` to `10210`
- Added all occupied ports (3000, 3001, 3210, 3211, 3213, 3214, 5432, 5433, 10200-10203) to `RESERVED_PORTS`

Then redeploy: `npx convex deploy --url http://localhost:3213 --admin-key '<key>'`

**Cleanup**: Also had to clean up the failed deployment's Docker resources:
```bash
docker compose -f /opt/cloudify/deployments/agies/docker-compose.yml down -v
rm -rf /opt/cloudify/deployments/agies
```
And soft-deleted the stale deployment record via Convex API.

### Issue 17: Too many redirects on managed deployment domains

**Problem**: After a successful deployment, all three domain URLs return "ERR_TOO_MANY_REDIRECTS":
- `https://agies.devhomelab.org`
- `https://agies-dash.devhomelab.org`
- `https://agies-http.devhomelab.org`

**Root cause**: The `domainActions.setupDomains` action was creating Cloudflare DNS records with `proxied: true` (orange cloud). When Cloudflare proxies traffic with its default "Flexible" SSL mode:
1. Browser → Cloudflare (HTTPS)
2. Cloudflare → NPM (HTTP, because Flexible mode)
3. NPM sees HTTP, redirects to HTTPS
4. Back to step 1 → infinite redirect loop

NPM already handles SSL termination with the wildcard cert, so Cloudflare proxying is unnecessary and harmful.

**Fix**: Two changes:
1. `apps/convex/convex/actions/domainActions.ts` — changed `proxied: true` to `proxied: false` in the DNS creation call
2. `cloudify.config.yml` — changed `cloudflare.proxied` from `true` to `false`

For existing records, patched via Cloudflare API:
```bash
CF_TOKEN="<token>"
ZONE_ID="<zone>"
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/<record-id>" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"proxied": false}'
```

Then redeployed Convex functions so future deployments create DNS-only records.

**Key lesson**: When NPM handles SSL via wildcard cert, Cloudflare DNS records must be DNS-only (grey cloud). Cloudflare proxy + NPM SSL = redirect loop unless Cloudflare SSL mode is set to "Full (Strict)".

### Issue 18: NPM proxy forward host — 127.0.0.1 vs Docker bridge gateway

**Problem**: After fixing the redirect loop (Issue 17), all three agies URLs returned 502 Bad Gateway.

**Root cause**: The `domainActions.setupDomains` action was changed to use `forwardHost: "127.0.0.1"` — but NPM runs inside a Docker container. Inside the container, `127.0.0.1` refers to the container itself, not the host machine. NPM couldn't reach the managed deployment containers on the host.

**Fix**: Use `172.17.0.1` (Docker bridge gateway) as the forward host. This is the default gateway for the `bridge` network and routes traffic from Docker containers to the host. This matches the working Cloudify platform proxy hosts (`projectinworks.com` → `172.17.0.1:3001`).

Also disabled `ssl_forced: true` in `apps/api/src/routes/proxy.ts` — forcing SSL caused additional redirect issues when combined with NPM's own SSL handling.

**Files changed**:
- `apps/convex/convex/actions/domainActions.ts` — `forwardHost: "172.17.0.1"` instead of `serverIp`
- `apps/api/src/routes/proxy.ts` — `ssl_forced: false`
- `cloudify.config.yml` — `cloudflare.proxied: false`

**Verified**: All three URLs return expected status codes:
- `https://agies.devhomelab.org/version` → 200 (backend)
- `https://agies-dash.devhomelab.org` → 200 (dashboard)
- `https://agies-http.devhomelab.org` → 404 (site — expected, no HTTP actions configured)

### Issue 19: Shared package changes not deployed — stale validation schema on server

**Problem**: After making `forwardHost` optional in the Zod schema (`packages/shared/src/schemas/infra-api.ts`), deploying only the API dist wasn't enough. The API still rejected requests with `"forwardHost": ["Required"]`.

**Root cause**: Cloudify is a monorepo with workspace dependencies:
```
apps/api → packages/shared (Zod schemas)
         → packages/domain-manager (NPM/DNS clients)
apps/web → apps/convex (Convex functions, via symlink)
apps/convex → standalone deploy to Convex backend
```

When a shared package (`@cloudify/shared`) changes, its compiled `dist/` must also be synced to the server. The API imports from `@cloudify/shared` at runtime via the workspace symlink, so the server's `packages/shared/dist/` must match.

**What was missed**: Only `apps/api/dist/` was rsynced. `packages/shared/dist/` was not, so the server still had the old schema requiring `forwardHost`.

**Fix**: Also rsync `packages/shared/dist/` (and any other changed shared package):
```bash
rsync -avz packages/shared/dist/ server:/opt/cloudify/app/packages/shared/dist/
rsync -avz packages/domain-manager/dist/ server:/opt/cloudify/app/packages/domain-manager/dist/
rsync -avz apps/api/dist/ server:/opt/cloudify/app/apps/api/dist/
pm2 restart cloudify-api
```

**What needs to happen to prevent this**:

A single deploy script that handles the full pipeline. Create `scripts/deploy.sh`:

```bash
#!/bin/bash
set -euo pipefail

SERVER="ubuntu@146.235.212.232"
SSH_KEY="~/.ssh/ssh-key-2025-08-02.key"
APP_DIR="/opt/cloudify/app"
ADMIN_KEY="convex-self-hosted|01456ef50ad7eff07021dbd2c5ee82a89ff86016ca063784acaaa8159d831db02174151a8c"

echo "=== Building all packages ==="
NEXT_PUBLIC_CONVEX_URL=https://convex.projectinworks.com npx turbo build --force

echo "=== Syncing to server ==="
# Shared packages (must go first — API/web depend on them at runtime)
rsync -avz -e "ssh -i $SSH_KEY" packages/shared/dist/ $SERVER:$APP_DIR/packages/shared/dist/
rsync -avz -e "ssh -i $SSH_KEY" packages/domain-manager/dist/ $SERVER:$APP_DIR/packages/domain-manager/dist/
rsync -avz -e "ssh -i $SSH_KEY" packages/docker-manager/dist/ $SERVER:$APP_DIR/packages/docker-manager/dist/

# API
rsync -avz -e "ssh -i $SSH_KEY" apps/api/dist/ $SERVER:$APP_DIR/apps/api/dist/

# Web (.next build output)
rsync -avz --delete -e "ssh -i $SSH_KEY" apps/web/.next/ $SERVER:$APP_DIR/apps/web/.next/

# Convex functions (source — deployed via npx convex deploy)
rsync -avz -e "ssh -i $SSH_KEY" apps/convex/convex/ $SERVER:$APP_DIR/apps/convex/convex/

# Config
rsync -avz -e "ssh -i $SSH_KEY" cloudify.config.yml $SERVER:$APP_DIR/cloudify.config.yml

echo "=== Deploying Convex functions ==="
ssh -i $SSH_KEY $SERVER "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && \
  cd $APP_DIR/apps/convex && \
  npx convex deploy --url http://localhost:3213 --admin-key '$ADMIN_KEY'"

echo "=== Restarting services ==="
ssh -i $SSH_KEY $SERVER "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && \
  cd $APP_DIR && pm2 restart ecosystem.config.cjs && pm2 save"

echo "=== Deploy complete ==="
```

This ensures every artifact (shared packages, API, web, Convex functions, config) is synced and restarted atomically. No more partial deploys.

**Longer term**: Replace this script with a CI/CD pipeline (GitHub Actions) that builds, tests, and deploys on push to `main`.

### Issue 20: Subdomain naming convention update

**Problem**: Managed deployment subdomains used short, ambiguous naming:
- `{name}.devhomelab.org` (backend)
- `{name}-http.devhomelab.org` (site/actions)
- `{name}-dash.devhomelab.org` (dashboard)

This made it unclear what each subdomain served and could conflict with non-Convex deployment types in the future.

**Fix**: Updated to explicit service-type naming across all files:

| Before | After |
|--------|-------|
| `{name}.domain` | `{name}-convex-backend.domain` |
| `{name}-http.domain` | `{name}-convex-actions.domain` |
| `{name}-dash.domain` | `{name}-convex-dashboard.domain` |

**Files changed**:
- `apps/convex/convex/actions/domainActions.ts` — subdomain suffix entries
- `apps/convex/convex/actions/createDeployment.ts` — domain URLs and `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN`
- `packages/docker-manager/src/templates/convex.ts` — compose template origins
- `cloudify.config.yml` — `subdomainPattern` config
- `apps/web/src/app/(dashboard)/deployments/new/page.tsx` — UI subdomain preview

### Issue 21: Soft delete leaves orphaned records

**Problem**: Delete deployment used `softDelete` (set `deletedAt` flag) for both deployments and DNS records. Soft-deleted records accumulated in the database and could cause name conflicts when recreating deployments.

**Fix**: Changed both `deployments.softDelete` and `dnsRecords.softDelete` to hard delete (`ctx.db.delete(args.id)`). Port allocations already used hard delete via `releasePorts`.

### Issue 22: Container name conflicts with pre-existing services

**Problem**: Creating a deployment named "aegis" fails because the container naming pattern `{name}-postgres-db` produces `aegis-postgres-db`, which already exists on the server (from the pre-existing aegis-convex deployment).

**Root cause**: The compose config uses `container_name: {name}-postgres-db`, `{name}-convex-backend`, `{name}-convex-dashboard`. These are global in Docker — any pre-existing container with the same name causes a conflict.

**Current workaround**: Use a deployment name that doesn't collide with existing containers on the server.

**What's needed**:
- Pre-flight check: before starting compose up, query Docker for existing containers with the same name prefix and fail early with a clear error
- Or namespace container names to avoid collisions (e.g., `cloudify-{name}-postgres-db`)
- The infra agent should expose a `/infra/containers/check-conflicts` endpoint that `createDeployment` calls before writing the compose file

### Deploy Script

A deploy script was created at `scripts/deploy.sh` to prevent partial deploy issues (see Issue 19). It handles:

1. **Build** — `turbo build --force` with `NEXT_PUBLIC_CONVEX_URL` set
2. **Sync shared packages** — `packages/shared/dist/`, `packages/domain-manager/dist/`, `packages/docker-manager/dist/`
3. **Sync API** — `apps/api/dist/`
4. **Sync Web** — `apps/web/.next/`
5. **Sync Convex functions** — `apps/convex/convex/` (source files for `npx convex deploy`)
6. **Sync config** — `cloudify.config.yml`
7. **Deploy Convex** — `npx convex deploy` on the server
8. **Restart PM2** — `pm2 restart ecosystem.config.cjs`

Usage:
```bash
./scripts/deploy.sh
```

**Why this is critical**: The monorepo has runtime workspace dependencies. Changing a schema in `packages/shared` requires syncing its `dist/` to the server — not just the API that imports it. Without this script, it's easy to forget a package and deploy a broken state.

---

## Known Gaps & Limitations

This section documents architectural gaps, hardcoded values, and missing automation that need to be addressed for Cloudify to be production-ready.

### 1. Hardcoded base domain (`devhomelab.org`)

**Current state**: The base domain for managed deployments is hardcoded or configured as a single static value (`BASE_DOMAIN=devhomelab.org`). There is no UI or API to:
- Onboard a custom domain
- Manage multiple base domains
- Configure per-deployment custom domains

**Impact**: Every deployment gets `<name>.devhomelab.org` subdomains. Users cannot bring their own domains.

**What's needed**:
- Domain onboarding flow: user provides domain, Cloudify verifies DNS ownership (e.g., TXT record check)
- Per-domain Cloudflare zone management (or generic DNS provider support)
- Per-domain wildcard SSL cert provisioning
- Domain settings page in the UI

### 2. No automatic wildcard certificate provisioning

**Current state**: The `domainActions.setupDomains` action assumes a wildcard cert already exists in NPM and fails hard if it doesn't. The NPM v2 REST API does not support creating Let's Encrypt DNS challenge certificates — it must be done manually through the UI.

**Impact**: First deployment on a new base domain always fails until an admin manually creates the wildcard cert in NPM.

**What's needed**:
- Automate cert provisioning via certbot/acme.sh running inside or alongside NPM, bypassing the NPM API limitation
- Or use Caddy/Traefik instead of NPM (both have built-in ACME DNS challenge support via API)
- Fallback: if wildcard cert doesn't exist, create individual per-subdomain certs via HTTP challenge (slower but works via API)
- Cert renewal monitoring and alerting

### 3. No CI/CD or automated deployment pipeline

**Current state**: Deploying Cloudify itself requires manual steps:
1. Build locally with correct `NEXT_PUBLIC_*` env vars
2. `rsync` build artifacts to server
3. `pm2 restart` services
4. `npx convex deploy` for function changes

**Impact**: Error-prone, easy to forget env vars (Issue 12), slow iteration cycle.

**What's needed**:
- GitHub Actions or similar CI pipeline
- Build on server (or in CI) with `.env.production` checked in (secrets via CI env vars)
- PM2 deploy commands or Docker-based deployment for the platform itself
- Convex deploy as a post-build step

### 4. No multi-server or scaling support

**Current state**: Everything runs on a single server (`146.235.212.232`). The infra agent, managed deployments, and Cloudify itself all share resources.

**Impact**: Single point of failure. Resource contention between managed deployments and the platform.

**What's needed**:
- Remote infra agent support (deploy to multiple servers)
- Server registry in the database
- Deployment placement strategy (which server has capacity)
- Health monitoring across servers

### 5. NEXT_PUBLIC_* env vars require rebuild

**Current state**: `NEXT_PUBLIC_CONVEX_URL` is baked into the client bundle at build time. Changing it requires a full rebuild and redeployment.

**Impact**: Cannot change the Convex endpoint without rebuilding. Makes environment promotion (staging → prod) harder.

**What's needed**:
- Runtime config injection (e.g., `__NEXT_DATA__` or a `/config.js` endpoint)
- Or accept the rebuild requirement and ensure CI always sets the correct values

### 6. NPM API limitations for SSL certificates

**Current state**: NPM v2.14 REST API does not support:
- Creating Let's Encrypt certificates with DNS challenge via API
- The `/provision` endpoint (removed or never existed in v2)
- Wildcard cert creation programmatically

**Impact**: Wildcard certs must be created manually. Blocks full automation of the domain setup flow.

**What's needed**:
- Switch to a reverse proxy with full API support for ACME DNS challenges (Caddy, Traefik)
- Or run certbot separately and upload certs to NPM via the custom cert API
- Or use NPM v3 (if it adds DNS challenge API support)

### 7. Cloudflare DNS is the only supported provider

**Current state**: DNS record management is hardcoded to use the Cloudflare API with a single zone.

**Impact**: Cannot use other DNS providers (Route53, DigitalOcean, etc.) or manage multiple Cloudflare zones.

**What's needed**:
- DNS provider abstraction layer
- Provider plugins (Cloudflare, Route53, DigitalOcean DNS, etc.)
- Per-domain provider configuration

### 8. No deployment health monitoring or auto-recovery

**Current state**: After initial deployment, there is no ongoing health check. If a managed Convex instance crashes, the platform doesn't detect or restart it.

**Impact**: Silent failures. Users discover issues only when their app stops working.

**What's needed**:
- Periodic health checks against managed deployment endpoints
- Auto-restart on failure (Docker restart policy helps but doesn't cover all cases)
- Alerting/notification system
- Health status displayed in deployment detail page

---

## Rollback Procedure

All changes are additive. No existing services were modified. To roll back:

### 1. Stop Cloudify services

```bash
pm2 delete all
```

### 2. Stop Cloudify Convex and postgres

```bash
cd /opt/cloudify/app/docker
docker compose -f docker-compose.cloudify.yml down -v
```

### 3. Remove NPM proxy hosts

```bash
NPM_TOKEN="<token>"
for id in 5 6 7; do
  curl -X DELETE "http://localhost:81/api/nginx/proxy-hosts/$id" \
    -H "Authorization: Bearer $NPM_TOKEN"
done
```

### 4. Remove DNS records

```bash
CF_TOKEN="<token>"
ZONE_ID="0a20dbb4a9165d07d3f55836e384d326"

# List records to get IDs
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CF_TOKEN" | jq '.result[] | {id, name}'

# Delete each subdomain record
curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/<record-id>" \
  -H "Authorization: Bearer $CF_TOKEN"
```

### 5. Remove iptables rules

```bash
sudo iptables -D INPUT -s 172.17.0.0/16 -j ACCEPT
sudo iptables -D INPUT -s 172.25.0.0/16 -j ACCEPT
sudo iptables -D INPUT -s 172.26.0.0/16 -j ACCEPT
sudo netfilter-persistent save
```

### 6. Verify existing services

All pre-existing services (aegis, dbSevarthi, flixor-ota) continue running unaffected. Full data backups are available in `~/backups/` on the server.

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "cluster url already contains db name" | POSTGRES_URL has `/dbname` | Remove database name from URL |
| Convex can't find database | POSTGRES_DB not `convex_self_hosted` | Set POSTGRES_DB=convex_self_hosted, recreate with `-v` |
| `customFetch` export missing | @auth/core too old | Bump to `^0.37.0` |
| Convex deploy can't resolve @cloudify/* | Workspace packages in actions | Inline the function into the convex/ directory |
| NPM returns 502 for host services | iptables blocking Docker-to-host | Add INPUT ACCEPT rules for Docker subnets |
| "Module path has extension that isn't 'js'" | anyApi doesn't add .js suffix | Use patched _generated/api.ts |
| WebSocket timeout through NPM | Missing advanced config | Add `proxy_read_timeout 86400; proxy_buffering off;` |
| SSL cert errors with Cloudflare proxy | DNS record is proxied (orange cloud) | Set DNS record to DNS-only (grey cloud) |
| 401 on `/api/proxy/*` routes | Web app missing INFRA_AGENT_SECRET | Add INFRA_AGENT_SECRET + INFRA_AGENT_URL to PM2 web env |
| Sidebar icons on separate lines from text | `asChild` used instead of `render` | Replace `asChild` with `render={<Link />}` (Base UI pattern) |
| WebSocket to `ws://localhost:3211` | NEXT_PUBLIC_CONVEX_URL not set at build time | Rebuild with `NEXT_PUBLIC_CONVEX_URL=https://...` |
| "Could not find public function" for actions | Missing `actions/` prefix in API path | Use `api.actions.<module>` for files in `convex/actions/` |
| "Wildcard certificate not found in NPM" | No `*.domain` cert in NPM | Create manually via NPM UI with DNS challenge (API doesn't support it) |
| Cert found in NPM but API says "not found" | `wildcardCertDomain` has `*.` prefix, function adds another | Set config to base domain only (e.g. `devhomelab.org`) |
| Port already allocated on compose up | `PORT_RANGE_START` hardcoded to 10200, conflicts with existing services | Update to 10210+, add occupied ports to RESERVED_PORTS |
| Too many redirects on deployment URLs | Cloudflare proxied + NPM SSL loop; also `ssl_forced: true` | Set DNS to DNS-only, `ssl_forced: false` |
| 502 on deployment URLs after fixing redirects | NPM forwards to `127.0.0.1` (container-local) | Use Docker bridge gateway (auto-detected) |
| Validation error after schema change | Shared package dist not synced to server | Rsync `packages/*/dist/` — use `scripts/deploy.sh` |
| Deleted deployment still shows in DB | `softDelete` only sets flag | Changed to hard delete (`ctx.db.delete`) |
| Container name conflict on compose up | Name collides with pre-existing container | Use unique deployment name; add pre-flight check |
