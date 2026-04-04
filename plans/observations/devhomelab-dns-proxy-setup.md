# Observation: devhomelab.org DNS, Reverse Proxy & Auth Callback Setup

**Date:** 2026-04-03
**Server:** 146.235.212.232 (Oracle Cloud ARM, Ubuntu 24.04)
**Domain:** devhomelab.org (Cloudflare DNS)

---

## 1. DNS Configuration

**Problem:** `devhomelab.org` was unreachable despite Cloudflare DNS being configured.

**Root Cause:** The root domain (`@`) had no A record. Only `www.devhomelab.org` had a record pointing to `146.235.212.232`.

**Fix:** Added an A record in Cloudflare:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `146.235.212.232` | DNS only (grey cloud) |

**Nameservers:** `ned.ns.cloudflare.com`, `reza.ns.cloudflare.com`

---

## 2. Nginx Proxy Manager Deployment

Deployed NPM as a Docker container to handle reverse proxying and SSL termination for all services on the server.

**Location on server:** `~/nginx-proxy-manager/docker-compose.yml`

**Ports:**
- `80` - HTTP
- `443` - HTTPS
- `81` - NPM Admin UI

**Docker network:** `npm-network` (bridge)

**Admin access:** `http://146.235.212.232:81` (default creds `admin@example.com` / `changeme`, changed on first login)

**SSL:** Let's Encrypt certificates auto-provisioned by NPM.

### docker-compose.yml

```yaml
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - npm-network

networks:
  npm-network:
    name: npm-network
    driver: bridge
```

---

## 3. Docker Networking: Container-to-Host Communication

**Problem:** When setting up NPM proxy hosts to forward to services running on the host (e.g., Convex on port 10201), using `127.0.0.1` as the forward host resulted in 502 Bad Gateway.

**Root Cause:** Inside a Docker container, `127.0.0.1` refers to the container itself, not the host machine. The host's services are not reachable via localhost from within the container.

**Fix:** Use the Docker bridge gateway IP `172.17.0.1` (the `docker0` interface) as the forward host in NPM proxy host configuration.

**Verification:** `sudo docker exec nginx-proxy-manager curl -s http://172.17.0.1:10201` returns 200.

**Current proxy host:**
- `devhomelab.org` -> `172.17.0.1:10201` (Convex backend API)

---

## 4. Convex OAuth Callback URL Issue

**Problem:** Google OAuth sign-in for `dbSevarthiProjectHub` redirects to `http://146.235.212.232:10202/api/auth/signin/google?...` using the raw IP instead of the domain name. This breaks when the server is behind a reverse proxy with SSL.

**Root Cause:** The Convex backend's `CONVEX_SITE_ORIGIN` and `CONVEX_CLOUD_ORIGIN` environment variables are set to the raw server IP in the docker-compose file.

**Where these are defined (only place):**

```
/home/ubuntu/dbSevarthiProjectHub/docker-compose.yml
```

```yaml
environment:
  - CONVEX_CLOUD_ORIGIN=http://${SERVER_IP}:10201
  - CONVEX_SITE_ORIGIN=http://${SERVER_IP}:10202
```

With `/home/ubuntu/dbSevarthiProjectHub/.env`:
```
SERVER_IP=146.235.212.232
```

**These are NOT defined in the application source code.** They are infrastructure-level env vars consumed directly by the `ghcr.io/get-convex/convex-backend` Docker image. The app code (`convex/auth.config.ts`) reads `CONVEX_SITE_URL` which Convex internally derives from `CONVEX_SITE_ORIGIN`.

**Source repo:** https://github.com/adityatoney/dbSevarthiProjectHub

### Current Port Mapping

| Port (Host) | Port (Container) | Service |
|---|---|---|
| 10200 | 10200 | Postgres |
| 10201 | 3210 | Convex Backend API |
| 10202 | 3211 | Convex Site Proxy (auth callbacks) |
| 10203 | 6791 | Convex Dashboard |
| 3000 | 3000 | Next.js Frontend (`dbsevarthi-nextjs`) |

---

## 5. Pending: Domain-Based Auth Callback Fix

To fix the OAuth callback issue, two things need to happen:

### a) Reverse Proxy Setup for Both Convex Ports

Convex requires two origins — the API and the site proxy (which handles auth callbacks). Since NPM maps one domain to one upstream, a subdomain is needed:

| Domain | NPM Forward To | Purpose |
|---|---|---|
| `devhomelab.org` | `172.17.0.1:10201` | Convex Backend API |
| `auth.devhomelab.org` | `172.17.0.1:10202` | Convex Site Proxy (OAuth callbacks) |

Requires adding a CNAME/A record for `auth.devhomelab.org` in Cloudflare and a new proxy host in NPM.

### b) Update docker-compose Environment Variables

```yaml
environment:
  - CONVEX_CLOUD_ORIGIN=https://devhomelab.org
  - CONVEX_SITE_ORIGIN=https://auth.devhomelab.org
```

Then recreate the containers: `sudo docker compose down && sudo docker compose up -d`

### c) Update Google Cloud Console

Update the authorized redirect URI in Google OAuth credentials from:
```
http://146.235.212.232:10202/api/auth/callback/google
```
To:
```
https://auth.devhomelab.org/api/auth/callback/google
```
