# Cloudify - Architecture & Implementation Plan

## Overview

Cloudify is a self-hosted deployment management platform. Users provision and manage infrastructure services through a web UI. Convex DB is the first supported service type, with Postgres and SpaceTimeDB planned.

**Phase 1 (Current):** Convex deployment management
**Phase 2 (Future):** Postgres instance management
**Phase 3 (Future):** SpaceTimeDB instance management

## Architecture Principles

- **Cloudify's own Convex instance** is a standard infrastructure dependency, provisioned as part of platform setup (scripts, ansible, docker-compose, helm). Same as any app that needs a database.
- **User-provisioned Convex instances** are what the platform creates and manages on behalf of users. Completely independent from Cloudify's own DB.
- **Stateless application tier** — web and infra agent containers hold no local state. All data lives in Convex. Enables horizontal scaling and K8s deployment.
- **SaaS-ready** — swap Cloudify's self-hosted Convex for Convex Cloud with one env var (`NEXT_PUBLIC_CONVEX_URL`).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Caches builds, runs dev in parallel, zero config overhead |
| Frontend | Next.js 15 (App Router) | SSR, file-based routing, real-time via Convex React client |
| UI | shadcn/ui + Tailwind CSS | Composable, customizable, great dashboard components |
| Infra Agent | Express.js + TypeScript | Docker socket access, DNS/proxy ops, system metrics |
| Database | Convex DB (self-hosted) | Real-time subscriptions, schema-based, scales to SaaS |
| Auth | Convex Auth | Built-in, session management handled by Convex |
| Type Sharing | Convex schema + Zod for infra API validation | Single source of truth for data types |
| Docker Mgmt | dockerode | Direct Docker Engine API via unix socket |
| System Metrics | systeminformation + dockerode stats | Host + per-container metrics |
| Config | YAML config + env var overrides | Branding, ports, service types all configurable |
| DNS | Cloudflare SDK (`cloudflare` npm) | Programmatic proxied A record creation per deployment |
| Reverse Proxy | Nginx Proxy Manager API | Auto-create proxy hosts with SSL + WebSocket support |
| SSL | Wildcard Let's Encrypt via NPM + Cloudflare DNS challenge | Single cert covers all `*.devhomelab.org` subdomains |

### Data Flow Architecture

```
+-------------+     real-time subscriptions      +------------------+
|  Next.js    |<-------------------------------->|  Convex Backend  |
|  (web)      |     mutations / queries          |  (Cloudify's DB) |
+------+------+                                  +--------+---------+
       | REST calls (infra ops only)                      |
       v                                                  | actions call
+---------------+                                         | infra agent
|  Express.js   |<----------------------------------------+
|  (infra agent)|
+------+--------+
       |
       +-- dockerode --> Docker Engine (containers, compose, stats)
       +-- cloudflare SDK --> Cloudflare API (DNS records)
       +-- NPM API client --> Nginx Proxy Manager (proxy hosts, SSL)
       +-- systeminformation --> Host metrics (CPU, RAM, disk)
```

- **Next.js** connects directly to Convex for all data reads (real-time) and writes (mutations)
- **Express infra agent** handles operations requiring host access (Docker, DNS, system)
- **Convex actions** call the infra agent internally when mutations need infrastructure changes
- No polling needed — Convex subscriptions push deployment status changes to all clients instantly

---

## Project Structure

```
cloudify/
  apps/
    web/                              # Next.js frontend
      app/
        (auth)/
          login/page.tsx
          setup/page.tsx              # First-run admin setup
        (dashboard)/
          layout.tsx                  # Sidebar + header layout
          page.tsx                    # Overview dashboard
          deployments/
            page.tsx                  # List all deployments
            new/page.tsx              # Create new deployment
            [id]/
              page.tsx                # Deployment detail (overview)
              logs/page.tsx
              metrics/page.tsx
              settings/page.tsx
          system/page.tsx             # Host system metrics
          settings/page.tsx           # App settings
        layout.tsx
      components/
        ui/                           # shadcn components
        deployments/                  # Deployment-specific components
        metrics/                      # Charts, stat cards
        layout/                       # Sidebar, header, nav
      lib/
        api/                          # Infra agent API client (Docker/DNS/metrics)
        hooks/                        # Custom hooks
      Dockerfile

    api/                              # Express.js infra agent
      src/
        index.ts                      # Express app entry
        routes/
          containers.routes.ts        # Docker container ops
          compose.routes.ts           # Docker compose lifecycle
          dns.routes.ts               # Cloudflare DNS ops
          proxy.routes.ts             # NPM proxy host ops
          metrics.routes.ts           # System + container metrics
          credentials.routes.ts       # Admin key generation
        middleware/
          auth.ts                     # Validates requests (shared secret with Convex)
          validate.ts
        config/
          index.ts                    # Loads cloudify.config.yml
      Dockerfile

    convex/                           # Convex functions (Cloudify's own DB)
      schema.ts                       # Data schema
      auth.ts                         # Convex Auth config
      deployments.ts                  # Queries + mutations
      dnsRecords.ts                   # Queries + mutations
      credentials.ts                  # Queries + mutations
      portAllocations.ts              # Port reservation logic
      auditLog.ts                     # Append-only audit log
      actions/                        # Convex actions (call infra agent)
        createDeployment.ts           # Orchestrates: ports -> DNS -> compose -> credentials
        deleteDeployment.ts           # Orchestrates: compose down -> DNS teardown -> release
        lifecycleActions.ts           # Start, stop, restart
        domainActions.ts              # Setup/teardown domains independently
      convex.config.ts
      _generated/                     # Convex codegen output

  packages/
    shared/                           # Shared types, Zod schemas, constants
      src/
        schemas/
          deployment.ts               # Deployment create/update validation
          infra-api.ts                # Infra agent request/response schemas
          config.ts                   # Config file schema
        types/
          deployment.ts
          metrics.ts
          service-registry.ts         # Service type definitions
        constants.ts
      package.json

    docker-manager/                   # Docker interaction layer
      src/
        client.ts                     # dockerode singleton
        compose.ts                    # Generate & manage compose files
        containers.ts                 # Container CRUD, start/stop/restart
        networks.ts                   # Network management
        volumes.ts                    # Volume management
        stats.ts                      # Container stats streaming
        templates/                    # Compose templates per service type
          convex.ts
          postgres.ts                 # Future
          spacetimedb.ts              # Future
      package.json

    domain-manager/                   # DNS + Reverse Proxy layer
      src/
        cloudflare.ts                 # Cloudflare SDK wrapper
        nginx-proxy.ts                # NPM API client
        ssl.ts                        # Wildcard cert management
        domain.ts                     # Orchestrator: DNS + proxy coordination
        types.ts                      # DomainConfig, ProxyHost, DNSRecord types
      package.json

  docker/
    docker-compose.dev.yml            # Dev: Cloudify's Convex + Postgres + web + api
    docker-compose.prod.yml           # Prod: same, pulling from registry

  cloudify.config.yml                 # App configuration
  turbo.json
  pnpm-workspace.yaml
  package.json
  .env.example
```

---

## Database Schema (Convex)

```typescript
// apps/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  deployments: defineTable({
    name: v.string(),
    serviceType: v.union(
      v.literal("convex"),
      v.literal("postgres"),
      v.literal("spacetimedb")
    ),
    status: v.union(
      v.literal("creating"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("degraded")
    ),
    containerPrefix: v.string(),
    config: v.any(),               // service-specific config JSON
    portMappings: v.any(),         // { postgres: 10200, backend: 10201, ... }
    domainUrls: v.optional(v.any()), // { backend: "https://...", site: "...", dashboard: "..." }
    deletedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"]),

  dnsRecords: defineTable({
    deploymentId: v.id("deployments"),
    subdomain: v.string(),
    fullDomain: v.string(),
    recordType: v.string(),        // "A" | "CNAME"
    cloudflareId: v.optional(v.string()),
    npmProxyId: v.optional(v.number()),
    serviceRole: v.string(),       // "backend" | "site" | "dashboard"
    targetPort: v.number(),
    websocket: v.boolean(),
    proxied: v.boolean(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_deployment", ["deploymentId"]),

  credentials: defineTable({
    deploymentId: v.id("deployments"),
    keyType: v.string(),           // "admin_key" | "connection_string"
    keyValue: v.string(),          // encrypted
    rotatedAt: v.optional(v.number()),
  })
    .index("by_deployment", ["deploymentId"]),

  portAllocations: defineTable({
    deploymentId: v.id("deployments"),
    port: v.number(),
    role: v.string(),              // "postgres" | "backend" | "site" | "dashboard"
  })
    .index("by_port", ["port"])
    .index("by_deployment", ["deploymentId"]),

  auditLog: defineTable({
    userId: v.optional(v.string()),
    action: v.string(),            // "create" | "start" | "stop" | "delete" | "dns_create" | ...
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    details: v.optional(v.any()),
  }),
});
```

---

## Service Registry Pattern (Extensibility)

Each service type (Convex, Postgres, SpaceTimeDB) is defined as a plugin conforming to a common interface:

```typescript
interface ServiceProvider {
  type: string;                           // "convex" | "postgres" | "spacetimedb"
  displayName: string;
  icon: string;
  defaultConfig: ServiceConfig;

  // Lifecycle
  create(opts: CreateOptions): Promise<Deployment>;
  start(deployment: Deployment): Promise<void>;
  stop(deployment: Deployment): Promise<void>;
  destroy(deployment: Deployment): Promise<void>;

  // Info
  getStatus(deployment: Deployment): Promise<ServiceStatus>;
  getCredentials(deployment: Deployment): Promise<Credential[]>;
  getMetrics(deployment: Deployment): Promise<ServiceMetrics>;

  // Compose
  generateComposeConfig(opts: CreateOptions): ComposeSpec;

  // Domain routing
  getSubdomainEntries(name: string): SubdomainEntry[];
  // Returns the subdomain definitions this service needs, e.g.:
  // [{ suffix: "", role: "backend", port: 3210, websocket: true },
  //  { suffix: "-http", role: "site", port: 3211, websocket: false },
  //  { suffix: "-dash", role: "dashboard", port: 6791, websocket: false }]
}
```

Adding a new service type = implementing this interface + adding a compose template. No changes to API routes, UI components use the same deployment list/detail views.

---

## API Surface

### Convex Functions (Data Layer)

All data operations go through Convex queries/mutations. The Next.js frontend subscribes to these in real-time.

```
Queries (real-time subscriptions):
  deployments.list             # All deployments with status
  deployments.get(id)          # Single deployment detail
  dnsRecords.byDeployment(id)  # Domain records for a deployment
  dnsRecords.listAll           # All domain records
  credentials.get(id)          # Credentials for a deployment
  portAllocations.list         # All allocated ports
  auditLog.list(filters)       # Paginated audit log

Mutations:
  deployments.updateStatus     # Update deployment status
  auditLog.append              # Write audit entry

Actions (call infra agent, then write results):
  actions.createDeployment     # Full orchestration: ports -> DNS -> compose -> credentials
  actions.deleteDeployment     # Teardown: compose down -> DNS -> release ports
  actions.startDeployment      # docker compose up
  actions.stopDeployment       # docker compose stop
  actions.restartDeployment    # docker compose restart
  actions.setupDomains         # Create CF records + NPM proxies
  actions.teardownDomains      # Remove CF records + NPM proxies
  actions.rotateCredentials    # Regenerate admin key
```

### Express Infra Agent (Host Operations)

The infra agent is a lightweight REST API that only handles operations requiring host access. Called by Convex actions, not by the frontend directly.

```
POST   /infra/compose/up              # docker compose up -d (body: { dir })
POST   /infra/compose/down            # docker compose down (body: { dir, volumes? })
POST   /infra/compose/write           # Write compose file + .env to disk

GET    /infra/containers               # List all Docker containers
POST   /infra/containers/:id/start
POST   /infra/containers/:id/stop
POST   /infra/containers/:id/restart
GET    /infra/containers/:id/logs      # Container logs (query: tail, since)
POST   /infra/containers/:id/exec     # Run command in container

POST   /infra/dns/create              # Create Cloudflare A record
DELETE /infra/dns/:recordId           # Delete Cloudflare record
GET    /infra/dns/list                # List Cloudflare records
GET    /infra/dns/verify              # Test Cloudflare connectivity

POST   /infra/proxy/create            # Create NPM proxy host
DELETE /infra/proxy/:id               # Delete NPM proxy host
GET    /infra/proxy/list              # List NPM proxy hosts
GET    /infra/proxy/cert              # Find wildcard cert

GET    /infra/metrics/system           # Host CPU, RAM, disk
GET    /infra/metrics/containers       # Per-container stats

POST   /infra/credentials/generate    # Run generate_admin_key.sh in container

GET    /health                         # Health check (no auth)
```

Secured via shared secret (`INFRA_AGENT_SECRET`) passed as `Authorization: Bearer` header.

---

## Domain Routing & SSL Architecture

### Overview

Every deployment gets public HTTPS subdomains under a configurable base domain (e.g., `devhomelab.org`). DNS is managed via the Cloudflare API, reverse proxying via the Nginx Proxy Manager API. A wildcard DNS record exists as a fallback only -- the primary path creates individual proxied Cloudflare records per deployment.

### Subdomain Pattern

For a deployment named `{name}`, the service provider defines subdomain entries. For Convex:

| Service | Subdomain | Routes To | WebSocket | Cloudflare Proxied |
|---|---|---|---|---|
| Backend API | `{name}.devhomelab.org` | host:{assigned_port} -> 3210 | Yes | Yes |
| HTTP Actions | `{name}-http.devhomelab.org` | host:{assigned_port} -> 3211 | No | Yes |
| Dashboard | `{name}-dash.devhomelab.org` | host:{assigned_port} -> 6791 | No | Yes |

Example: deployment "aegis" gets `aegis.devhomelab.org`, `aegis-http.devhomelab.org`, `aegis-dash.devhomelab.org`.

### DNS Strategy: Cloudflare Proxied Records (Primary) + Wildcard (Fallback)

**Primary -- Individual Proxied A Records via Cloudflare API:**
- On deployment creation, Cloudify calls the Cloudflare SDK to create individual A records pointing to the server IP
- Records are **proxied** (orange cloud) -- Cloudflare DDoS protection, CDN, and IP masking enabled
- On deployment deletion, Cloudify deletes the corresponding DNS records
- Cloudflare record IDs stored in `dnsRecords` table for cleanup

**Fallback -- Wildcard DNS:**
- A `*.devhomelab.org` wildcard A record exists in Cloudflare (DNS-only, grey cloud -- free plan can't proxy wildcards)
- Ensures subdomains resolve even if Cloudflare API call fails or is delayed
- NPM will still route correctly since proxy hosts are created independently of DNS

### Cloudflare Integration (`packages/domain-manager/src/cloudflare.ts`)

```typescript
// Uses official `cloudflare` npm package (v5.x)
// Requires: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID

interface CloudflareManager {
  createRecord(subdomain: string, ip: string, proxied: boolean): Promise<{ id: string }>;
  deleteRecord(recordId: string): Promise<void>;
  listRecords(prefix?: string): Promise<DNSRecord[]>;
  verifyConnection(): Promise<boolean>;
}
```

**Token permissions required:**
- Zone: DNS: Edit
- Zone: Zone: Read
- Scoped to devhomelab.org zone only

**Rate limits:** 1,200 requests per 5 minutes (non-issue -- 3 records per deployment).

### Nginx Proxy Manager Integration (`packages/domain-manager/src/nginx-proxy.ts`)

NPM has an undocumented but fully functional REST API (the web UI uses it internally).

```typescript
// Authenticates via POST /api/tokens, caches JWT (30-day expiry)
// Requires: NPM_URL, NPM_EMAIL, NPM_PASSWORD

interface NginxProxyManager {
  authenticate(): Promise<string>;  // Returns JWT
  createProxyHost(config: ProxyHostConfig): Promise<{ id: number }>;
  deleteProxyHost(id: number): Promise<void>;
  listProxyHosts(): Promise<ProxyHost[]>;
  findWildcardCert(domain: string): Promise<number | null>;
}

interface ProxyHostConfig {
  domain_names: string[];              // ["aegis.devhomelab.org"]
  forward_scheme: "http";
  forward_host: string;                // Server IP or Docker host IP
  forward_port: number;                // Host-mapped port
  allow_websocket_upgrade: boolean;    // CRITICAL: true for Convex backend
  certificate_id: number;             // Wildcard cert ID
  ssl_forced: true;
  http2_support: true;
  block_exploits: true;
  advanced_config: string;            // Custom nginx directives if needed
}
```

### SSL: Wildcard Certificate

A single wildcard Let's Encrypt certificate is provisioned **once** via NPM:
- Covers `*.devhomelab.org` + `devhomelab.org`
- Uses Cloudflare DNS challenge for validation (NPM supports this natively)
- Auto-renews via NPM
- All proxy hosts reference this one certificate by ID
- Cloudify discovers the cert ID at startup via `GET /api/nginx/certificates`

### Convex Behind Reverse Proxy -- Requirements

Confirmed working in production. Critical settings:
- **WebSocket upgrade required** on backend proxy host (`allow_websocket_upgrade: true`)
- NPM automatically adds required headers: `Upgrade`, `Connection: "upgrade"`
- `proxy_read_timeout 86400` (24h) prevents WebSocket disconnects -- add via NPM `advanced_config`
- `proxy_buffering off` for real-time sync -- add via NPM `advanced_config`
- HTTP/2 enabled on SSL side

Advanced nginx config injected per Convex backend proxy host:
```nginx
proxy_read_timeout 86400;
proxy_buffering off;
```

### Error Handling & Rollback

Domain setup is a multi-step process (Cloudflare + NPM per subdomain). If any step fails:

1. **Partial failure:** Roll back completed DNS records and proxy hosts
2. **Cloudflare down:** Deployment still works via wildcard fallback (DNS-only, no proxy benefits)
3. **NPM down:** Deployment is created but not routable -- marked as "degraded" status, user notified, retry available
4. **Cleanup on delete:** All Cloudflare records and NPM proxy hosts removed using stored IDs from `dnsRecords` table

---

## Convex Deployment Flow (Phase 1 Detail)

### Creating a New Convex Instance

When user clicks "New Deployment" -> selects "Convex":

1. **User provides:**
   - Deployment name (e.g., "my-project")
   - Backend port (auto-assigned or custom)
   - Site proxy port (auto-assigned or custom)
   - Dashboard port (auto-assigned or custom)
   - Postgres port (auto-assigned or custom)
   - Whether to use shared or dedicated Postgres

2. **Convex action `createDeployment` orchestrates:**
   - Validates input, checks port conflicts via Convex mutation
   - Reserves ports in `portAllocations` table
   - Calls infra agent `POST /infra/dns/create` x3 -- creates Cloudflare proxied A records
   - Calls infra agent `POST /infra/proxy/create` x3 -- creates NPM proxy hosts (WebSocket ON for backend)
   - Stores Cloudflare record IDs + NPM proxy host IDs in `dnsRecords` table
   - Calls infra agent `POST /infra/compose/write` -- generates docker-compose.yml with:
     - postgres container (with correct healthcheck using right port/user/db)
     - convex-backend with HTTPS domain URLs:
       - `CONVEX_CLOUD_ORIGIN=https://{name}.devhomelab.org`
       - `CONVEX_SITE_ORIGIN=https://{name}-http.devhomelab.org`
     - convex-dashboard with `NEXT_PUBLIC_DEPLOYMENT_URL=https://{name}.devhomelab.org`
   - Calls infra agent `POST /infra/compose/up`
   - Polls infra agent for container health (timeout 60s)
   - Calls infra agent `POST /infra/credentials/generate` -- runs `generate_admin_key.sh`
   - Stores deployment + credentials in Convex
   - Writes audit log
   - **All connected clients see the new deployment appear in real-time**

3. **Key technical details (lessons from our server debugging):**
   - Postgres healthcheck MUST use correct port, user, and db name
   - Postgres `command: -p <port>` must match healthcheck port
   - Admin key requires running `generate_admin_key.sh` (not just concatenating instance_name|secret)
   - Each deployment gets its own Docker network (compose default)

### Port Management
- Port registry lives in Convex `portAllocations` table
- Auto-assign from configurable ranges (default: 10200-10999)
- Each Convex deployment needs 4 ports: postgres, backend API, site proxy, dashboard
- Validate no conflicts before creating

---

## Docker Compose Templates

### Dev (docker-compose.dev.yml) -- Cloudify Platform

```yaml
services:
  # --- Cloudify's own infrastructure ---
  cloudify-postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: cloudify
      POSTGRES_PASSWORD: ${CLOUDIFY_DB_PASSWORD}
      POSTGRES_DB: cloudify
    volumes:
      - cloudify_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cloudify -d cloudify"]
      interval: 5s
      timeout: 3s
      retries: 10

  cloudify-convex:
    image: ghcr.io/get-convex/convex-backend:latest
    restart: unless-stopped
    ports:
      - "${CLOUDIFY_CONVEX_PORT:-3211}:3210"
    environment:
      - POSTGRES_URL=postgresql://cloudify:${CLOUDIFY_DB_PASSWORD}@cloudify-postgres:5432
      - CONVEX_CLOUD_ORIGIN=${CLOUDIFY_CONVEX_URL:-http://localhost:3211}
      - CONVEX_SITE_ORIGIN=${CLOUDIFY_CONVEX_SITE:-http://localhost:3212}
      - DO_NOT_REQUIRE_SSL=true
    depends_on:
      cloudify-postgres:
        condition: service_healthy
    volumes:
      - cloudify_convex_data:/convex/data
    healthcheck:
      test: curl -f http://localhost:3210/version
      interval: 5s
      start_period: 15s

  # --- Cloudify application ---
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: dev
    ports:
      - "${WEB_PORT:-3000}:3000"
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
    environment:
      - NEXT_PUBLIC_CONVEX_URL=${CLOUDIFY_CONVEX_URL:-http://localhost:3211}
      - INFRA_AGENT_URL=http://api:4000
    depends_on:
      cloudify-convex:
        condition: service_healthy

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: dev
    ports:
      - "${API_PORT:-4000}:4000"
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - INFRA_AGENT_SECRET=${INFRA_AGENT_SECRET}
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
      - CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID}
      - NPM_URL=${NPM_URL:-http://host.docker.internal:81}
      - NPM_EMAIL=${NPM_EMAIL}
      - NPM_PASSWORD=${NPM_PASSWORD}
      - SERVER_IP=${SERVER_IP}

volumes:
  cloudify_pgdata:
  cloudify_convex_data:
```

### Prod (docker-compose.prod.yml)

```yaml
services:
  cloudify-postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: cloudify
      POSTGRES_PASSWORD: ${CLOUDIFY_DB_PASSWORD}
      POSTGRES_DB: cloudify
    volumes:
      - cloudify_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cloudify -d cloudify"]
      interval: 5s
      timeout: 3s
      retries: 10

  cloudify-convex:
    image: ghcr.io/get-convex/convex-backend:latest
    restart: unless-stopped
    environment:
      - POSTGRES_URL=postgresql://cloudify:${CLOUDIFY_DB_PASSWORD}@cloudify-postgres:5432
      - CONVEX_CLOUD_ORIGIN=${CLOUDIFY_CONVEX_URL}
      - CONVEX_SITE_ORIGIN=${CLOUDIFY_CONVEX_SITE}
      - DO_NOT_REQUIRE_SSL=true
    depends_on:
      cloudify-postgres:
        condition: service_healthy
    volumes:
      - cloudify_convex_data:/convex/data
    healthcheck:
      test: curl -f http://localhost:3210/version
      interval: 5s
      start_period: 15s

  web:
    image: ${REGISTRY:-ghcr.io/user}/cloudify-web:${TAG:-latest}
    ports:
      - "${WEB_PORT:-3000}:3000"
    environment:
      - NEXT_PUBLIC_CONVEX_URL=${CLOUDIFY_CONVEX_URL}
      - INFRA_AGENT_URL=http://api:4000
    depends_on:
      cloudify-convex:
        condition: service_healthy

  api:
    image: ${REGISTRY:-ghcr.io/user}/cloudify-api:${TAG:-latest}
    ports:
      - "${API_PORT:-4000}:4000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - INFRA_AGENT_SECRET=${INFRA_AGENT_SECRET}
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
      - CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID}
      - NPM_URL=${NPM_URL}
      - NPM_EMAIL=${NPM_EMAIL}
      - NPM_PASSWORD=${NPM_PASSWORD}
      - SERVER_IP=${SERVER_IP}

volumes:
  cloudify_pgdata:
  cloudify_convex_data:
```

### K8s Path (Future)

```
Namespace: cloudify
  Deployment: cloudify-web (replicas: 2+, stateless)
  Deployment: cloudify-api (replicas: 2+, stateless, needs Docker/K8s API access)
  StatefulSet: cloudify-convex (1 replica, persistent volume)
  StatefulSet: cloudify-postgres (1 replica, persistent volume)
  Service: cloudify-web-svc
  Service: cloudify-api-svc
  Ingress: cloudify.devhomelab.org
```

Or with Convex Cloud: drop both StatefulSets, just Deployments + Ingress.

---

## Configuration File

```yaml
# cloudify.config.yml
app:
  name: "Cloudify"                    # Easily changeable branding
  description: "Deployment Manager"
  version: "1.0.0"

server:
  host: "0.0.0.0"
  webPort: 3000
  apiPort: 4000
  serverIp: "146.235.212.232"

domain:
  baseDomain: "devhomelab.org"
  wildcardFallback: true
  scheme: "https"

cloudflare:
  apiToken: ""                        # Override via CLOUDFLARE_API_TOKEN env var
  zoneId: ""                          # Override via CLOUDFLARE_ZONE_ID env var
  proxied: true
  ttl: 1                              # 1 = automatic

nginxProxyManager:
  url: "http://localhost:81"
  email: ""                           # Override via NPM_EMAIL env var
  password: ""                        # Override via NPM_PASSWORD env var
  wildcardCertDomain: "*.devhomelab.org"
  backendAdvancedConfig: |
    proxy_read_timeout 86400;
    proxy_buffering off;

convex:
  url: ""                             # Override via NEXT_PUBLIC_CONVEX_URL env var
  deployKey: ""                       # Override via CONVEX_DEPLOY_KEY env var

ports:
  rangeStart: 10200
  rangeEnd: 10999
  reservedPorts: [80, 443, 3000, 4000, 5432, 6791, 8080]

services:
  convex:
    enabled: true
    images:
      backend: "ghcr.io/get-convex/convex-backend:latest"
      dashboard: "ghcr.io/get-convex/convex-dashboard:latest"
      postgres: "postgres:16-alpine"
    subdomainPattern:
      backend: "{name}"
      site: "{name}-http"
      dashboard: "{name}-dash"
  postgres:
    enabled: false                    # Phase 2
    images:
      postgres: "postgres:16-alpine"
  spacetimedb:
    enabled: false                    # Phase 3

branding:
  primaryColor: "#6366f1"
  logo: ""
```

---

## UI Pages & Components

### Dashboard Overview (`/`)
- Grid of stat cards: Total deployments, Running, Stopped, Host CPU/RAM/Disk
- Recent deployments list (quick status view) -- **real-time via Convex subscription**
- Infrastructure health: Cloudflare, NPM, wildcard cert status

### Deployments List (`/deployments`)
- Data table with columns: Name, Type, Status (badge), Domain URL, Created, Actions
- **Real-time status updates** -- no polling, Convex pushes changes
- Filter by type, status
- Row actions: Start, Stop, Restart, Delete
- "New Deployment" button

### New Deployment (`/deployments/new`)
- Step 1: Select service type (Convex card, greyed-out Postgres/SpaceTimeDB cards for future)
- Step 2: Configure name, ports (with auto-assign option)
  - Live subdomain preview: shows `{name}.devhomelab.org` etc. as user types
- Step 3: Review & create (shows domain URLs, port mappings)
- Step 4: Success screen with:
  - Admin key (copy button, shown once warning)
  - Domain URLs with copy buttons and direct links
  - Quick "Open Dashboard" button linking to `https://{name}-dash.devhomelab.org`

### Deployment Detail (`/deployments/[id]`)
- Tabs: Overview | Logs | Metrics | Domains | Settings
- **Overview:** Status (real-time), container list, credentials (masked with reveal), domain URLs with links, quick actions
- **Logs:** Live-scrolling container logs (select which container)
- **Metrics:** CPU/RAM charts per container
- **Domains:** Subdomain list, Cloudflare proxy status, NPM proxy status, re-create/delete actions
- **Settings:** Config display, danger zone (stop, delete)

### System (`/system`)
- Host metrics: CPU, RAM, Disk gauges/charts
- All Docker containers table
- Docker engine info

### shadcn Components to Install
- Sidebar, Card, Badge, Data Table, Dialog, Sheet, Form, Tabs
- Dropdown Menu, Alert, Toast (Sonner), Skeleton, Command (Cmd+K)
- Chart (built-in Recharts wrapper)

---

## Security Considerations

1. **Docker socket access:** The infra agent container has full Docker control. Secured via shared secret.
2. **Credential storage:** Admin keys encrypted at rest in Convex (aes-256-gcm with a key from env var).
3. **Infra agent auth:** Shared secret (`INFRA_AGENT_SECRET`) between Convex actions and Express. Not exposed to frontend.
4. **Convex Auth:** Handles user authentication, session management, CSRF protection.
5. **Input validation:** All user input validated via Convex schema validators + Zod for infra API.
6. **Audit trail:** Every deployment action logged in Convex `auditLog` table.
7. **Cloudflare API token:** Scoped to minimum permissions (DNS Edit + Zone Read on single zone). Env var only.
8. **NPM credentials:** Env vars only. JWT cached in memory.
9. **Subdomain validation:** Deployment names validated (alphanumeric + hyphens) to prevent DNS injection.

---

## Key Decisions & Rationale

| Decision | Rationale |
|---|---|
| Convex DB for Cloudify's own data | Real-time subscriptions, stateless app tier, SaaS-ready, K8s-ready |
| Convex as infra dependency, not bootstrap | Standard platform setup, same as any app needing a DB |
| Express as thin infra agent | Only Docker/DNS/system ops need host access; all data through Convex |
| Convex actions orchestrate deployments | Actions can call infra agent then write results atomically |
| Convex Auth over custom sessions | Built-in, handles edge cases, no session store to manage |
| dockerode over compose CLI | Programmatic control, no stdout parsing, streams support |
| REST infra API over direct Docker in Convex | Convex functions can't access Docker socket; clean separation |
| Cloudflare proxied records over wildcard-only | Free plan can't proxy wildcards; individual records get DDoS/CDN/IP masking |
| Wildcard DNS as fallback only | Ensures resolution even if Cloudflare API fails |
| NPM API over Traefik/Caddy | Already running on the host; undocumented API but fully functional |
| domain-manager as separate package | Isolates DNS/proxy logic; testable; swappable if moving off Cloudflare/NPM |
| YAML config over all-env-vars | Readable, versionable, with env overrides for secrets |
| Stateless web + api | Horizontal scaling, K8s Deployments with replicas, zero local state |
