# Cloudify -- Implementation Plan

Milestones ordered by dependency. Each milestone delivers a testable, working increment.

---

## Milestone 1: Project Foundation

> **Goal:** Monorepo scaffolded, all packages buildable, Convex schema deployed, infra agent running, dev environment in Docker.

### Phase 1.1 -- Monorepo & Tooling

- [ ] Init git repo, `.gitignore`, `.env.example`
- [ ] Init pnpm workspace (`pnpm-workspace.yaml` with `apps/*` and `packages/*`)
- [ ] Init root `package.json` with workspace scripts
- [ ] Init `turbo.json` with `build`, `dev`, `lint`, `typecheck` pipelines
- [ ] Verify `pnpm install` and `turbo build` work

**Deliverable:** Empty monorepo that builds.

### Phase 1.2 -- Shared Package

- [ ] Init `packages/shared` with `tsup`
- [ ] Config schema (`schemas/config.ts`) -- Zod schema matching `cloudify.config.yml`
- [ ] Deployment schemas (`schemas/deployment.ts`) -- create, update validation
- [ ] Infra API schemas (`schemas/infra-api.ts`) -- request/response for infra agent endpoints
- [ ] Types: `ServiceProvider` interface, `SubdomainEntry`, `Deployment`, `Metrics`
- [ ] Constants: default port ranges, service type enum, status enum
- [ ] Export from `index.ts`

**Deliverable:** Shared types importable by all packages.

### Phase 1.3 -- Convex Schema & Functions

- [ ] Init `apps/convex` with Convex project (`npx convex init`)
- [ ] Define schema: `deployments`, `dnsRecords`, `credentials`, `portAllocations`, `auditLog`
- [ ] Stub queries: `deployments.list`, `deployments.get`, `dnsRecords.byDeployment`, `credentials.get`, `auditLog.list`
- [ ] Stub mutations: `deployments.updateStatus`, `auditLog.append`
- [ ] Set up Convex Auth (basic username/password provider for now)
- [ ] Deploy schema to Cloudify's own Convex instance
- [ ] Verify: schema applied, queries return empty results

**Deliverable:** Convex DB ready with schema and auth.

### Phase 1.4 -- Docker Manager Package

- [ ] Init `packages/docker-manager` with `dockerode`
- [ ] `client.ts` -- dockerode singleton via `/var/run/docker.sock`
- [ ] `containers.ts` -- list, start, stop, restart, remove, getLogs, execInContainer
- [ ] `compose.ts` -- writeComposeFile, composeUp, composeDown, composeDownWithVolumes
- [ ] `stats.ts` -- getContainerStats (CPU%, mem, net I/O)
- [ ] `volumes.ts` -- listVolumes, removeVolume
- [ ] `templates/convex.ts` -- generates Convex docker-compose.yml with correct healthchecks
- [ ] Test: connect to Docker, list containers

**Deliverable:** Docker operations abstracted.

### Phase 1.5 -- Domain Manager Package

- [ ] Init `packages/domain-manager` with `cloudflare` npm SDK
- [ ] `cloudflare.ts` -- createARecord, deleteRecord, listRecords, verifyConnection
- [ ] `nginx-proxy.ts` -- authenticate, createProxyHost, deleteProxyHost, listProxyHosts, findWildcardCert
- [ ] `ssl.ts` -- discoverWildcardCert at startup
- [ ] `domain.ts` -- DomainOrchestrator: setupDomains, teardownDomains, verifyConnectivity, rollback
- [ ] `types.ts` -- DomainConfig, ProxyHostConfig, DNSRecord, SubdomainEntry
- [ ] Test: create/delete a test Cloudflare record (already confirmed working)

**Deliverable:** DNS + reverse proxy automation ready.

### Phase 1.6 -- Config System

- [ ] Create `cloudify.config.yml` with all sections
- [ ] `apps/api/src/config/index.ts` -- load YAML, merge env var overrides, validate with Zod
- [ ] `.env.example` documenting all env vars

**Deliverable:** Config system ready.

### Phase 1.7 -- Infra Agent Foundation

- [ ] `apps/api/src/index.ts` -- Express app with CORS, JSON parser, error handler
- [ ] `middleware/auth.ts` -- validates `INFRA_AGENT_SECRET` bearer token
- [ ] `middleware/validate.ts` -- Zod validation for request bodies
- [ ] Health endpoint: `GET /health` (no auth)
- [ ] Wire up docker-manager and domain-manager packages
- [ ] `Dockerfile` for infra agent (multi-stage: dev + prod)

**Deliverable:** Infra agent running, secured, health check passing.

### Phase 1.8 -- Docker Dev Environment

- [ ] `apps/web/Dockerfile` -- multi-stage (dev with hot reload, prod with build)
- [ ] `docker/docker-compose.dev.yml` -- cloudify-postgres + cloudify-convex + web + api
- [ ] `docker/docker-compose.prod.yml` -- same, pulling from registry
- [ ] Platform setup script: provisions Cloudify's own Convex instance, runs `npx convex deploy`
- [ ] Verify: `docker compose -f docker/docker-compose.dev.yml up` starts full stack
- [ ] Web responds on `:3000`, API on `:4000/health`, Convex on `:3211`

**Deliverable:** `docker compose up` runs the full dev platform.

---

## Milestone 2: Authentication & Dashboard Shell

> **Goal:** User can log in, see a dashboard layout with sidebar navigation, and view system metrics. All pages behind auth.

### Phase 2.1 -- Convex Auth Setup

- [ ] Configure Convex Auth with username/password provider
- [ ] Auth functions: signup (first-run only), login, logout, getCurrentUser
- [ ] First-run detection: query if any users exist
- [ ] Test: create user via Convex, verify auth token works

**Deliverable:** Auth working at the Convex level.

### Phase 2.2 -- Next.js Foundation + shadcn/ui

- [ ] Init Next.js 15 app with App Router, TypeScript, Tailwind CSS
- [ ] Install shadcn/ui, init with default config
- [ ] Install components: Sidebar, Card, Badge, Button, Input, Form, Tabs, Dialog, Sheet, Dropdown Menu, Toast (Sonner), Skeleton, Command
- [ ] Set up Convex React client (`ConvexProvider`, `ConvexAuthProvider`)
- [ ] Set up infra agent API client (`lib/api/client.ts`) -- fetch with shared secret for server-side calls
- [ ] Custom hooks: `useCurrentUser()`, `useRequireAuth()`

**Deliverable:** Next.js wired to Convex with UI library ready.

### Phase 2.3 -- Auth UI

- [ ] `app/(auth)/layout.tsx` -- centered card layout
- [ ] `app/(auth)/setup/page.tsx` -- first-run wizard: create admin username + password
- [ ] `app/(auth)/login/page.tsx` -- login form
- [ ] Redirect logic: no users -> setup; not logged in -> login; logged in -> dashboard
- [ ] Test: full flow: first visit -> setup -> login -> dashboard

**Deliverable:** User can create account and log in.

### Phase 2.4 -- Dashboard Layout

- [ ] `app/(dashboard)/layout.tsx` -- sidebar + main content area
- [ ] `components/layout/sidebar.tsx` -- nav: Dashboard, Deployments, System, Settings
  - App name from config (branding)
  - Active route highlighting
  - Collapsible on mobile
- [ ] `components/layout/header.tsx` -- page title, user menu (logout)
- [ ] `app/(dashboard)/page.tsx` -- overview dashboard (placeholder cards)

**Deliverable:** Dashboard shell with navigation.

### Phase 2.5 -- System Metrics

- [ ] Infra agent routes:
  - `GET /infra/metrics/system` -- CPU%, RAM, disk, uptime, load avg via `systeminformation`
  - `GET /infra/metrics/containers` -- all Docker containers with stats via dockerode
- [ ] `app/(dashboard)/system/page.tsx`:
  - Stat cards: CPU, RAM, Disk (gauge style)
  - Docker containers table (all containers, not just Cloudify-managed)
  - Auto-refresh every 5s

**Deliverable:** System monitoring visible.

---

## Milestone 3: Domain Infrastructure

> **Goal:** Cloudflare DNS records and NPM proxy hosts created/deleted via API. Wildcard cert discovered. Health checks in UI.

### Phase 3.1 -- Cloudflare Wiring

- [ ] Infra agent routes:
  - `POST /infra/dns/create` -- create A record
  - `DELETE /infra/dns/:recordId` -- delete record
  - `GET /infra/dns/list` -- list records
  - `GET /infra/dns/verify` -- connectivity check
- [ ] Test via infra agent: create and delete a test record

**Deliverable:** Cloudflare ops available via infra agent.

### Phase 3.2 -- NPM Wiring

- [ ] Infra agent routes:
  - `POST /infra/proxy/create` -- create proxy host
  - `DELETE /infra/proxy/:id` -- delete proxy host
  - `GET /infra/proxy/list` -- list proxy hosts
  - `GET /infra/proxy/cert` -- find wildcard cert
- [ ] Authenticate on startup, cache JWT, re-auth on 401
- [ ] Wildcard cert discovery at startup
- [ ] Test: create and delete a test proxy host

**Deliverable:** NPM ops available via infra agent.

### Phase 3.3 -- Domain Orchestrator via Convex Actions

- [ ] Convex action `actions/domainActions.ts`:
  - `setupDomains(name, subdomainEntries, serverIp)` -- calls infra agent for CF + NPM, stores IDs in `dnsRecords`
  - `teardownDomains(deploymentId)` -- reads IDs from `dnsRecords`, calls infra agent to delete, marks deleted
- [ ] Rollback tested: simulate NPM failure after CF record created -> CF record cleaned up
- [ ] Test end-to-end: create 3 domains, verify CF + NPM, delete and verify cleanup

**Deliverable:** Domain lifecycle fully automated via Convex actions.

### Phase 3.4 -- Infrastructure Status UI

- [ ] `app/(dashboard)/settings/page.tsx` -- infrastructure status section:
  - Cloudflare connection (green/red)
  - NPM connection (green/red)
  - Wildcard cert status (found/not found, expiry)
  - Total DNS records managed
  - "Test Connectivity" button

**Deliverable:** Admin can verify infra health from UI.

---

## Milestone 4: Convex Deployment Engine

> **Goal:** Create, start, stop, restart, delete Convex deployments from UI. HTTPS subdomains, auto-assigned ports, admin key retrieval. All real-time.

### Phase 4.1 -- Port Manager

- [ ] Convex mutations in `portAllocations.ts`:
  - `allocatePorts(count, deploymentId)` -- find N available ports in range, reserve
  - `releasePorts(deploymentId)` -- free ports
  - `isPortAvailable(port)` -- check allocation table
- [ ] Configurable range from config (default 10200-10999)
- [ ] Reserved ports list respected
- [ ] Test: allocate for 3 deployments, verify no conflicts, release and re-allocate

**Deliverable:** Port conflicts impossible.

### Phase 4.2 -- Convex Service Provider

- [ ] Infra agent routes:
  - `POST /infra/compose/write` -- write docker-compose.yml + .env to disk
  - `POST /infra/compose/up` -- docker compose up -d
  - `POST /infra/compose/down` -- docker compose down (optional: with volumes)
  - `POST /infra/credentials/generate` -- exec `generate_admin_key.sh` in container
- [ ] `templates/convex.ts` -- compose template with correct healthchecks, HTTPS origins, port mappings
- [ ] Test: write compose, up, verify containers running, generate admin key

**Deliverable:** Convex container lifecycle via infra agent.

### Phase 4.3 -- Create Deployment Action

- [ ] Convex action `actions/createDeployment.ts`:
  1. Validate name (alphanumeric + hyphens, unique)
  2. Allocate 4 ports via `portAllocations` mutations
  3. Call `setupDomains` (CF records + NPM proxies)
  4. Call infra agent `compose/write` with Convex template
  5. Call infra agent `compose/up`
  6. Poll infra agent for container health (timeout 60s)
  7. Call infra agent `credentials/generate`
  8. Store deployment + credentials in Convex
  9. Write audit log
  10. Return deployment with credentials + domain URLs
- [ ] Error handling: rollback DNS, compose down, release ports on failure
- [ ] Test: create via Convex action, verify everything provisioned

**Deliverable:** One action creates a full Convex deployment.

### Phase 4.4 -- Lifecycle Actions

- [ ] Convex action `actions/deleteDeployment.ts` -- compose down -v, teardown domains, release ports, soft-delete
- [ ] Convex action `actions/lifecycleActions.ts` -- start (compose up), stop (compose stop), restart (compose restart)
- [ ] All actions update deployment status in real-time + write audit log
- [ ] Test: full lifecycle -- create -> stop -> start -> restart -> delete

**Deliverable:** Complete deployment lifecycle.

### Phase 4.5 -- Deployments List UI

- [ ] Real-time hooks using Convex React: `useQuery(api.deployments.list)`
- [ ] `app/(dashboard)/deployments/page.tsx`:
  - Data table: Name (link), Type badge, Status badge (real-time), Domain URL (clickable), Created, Actions dropdown
  - "New Deployment" button
  - Empty state with CTA
  - **Status updates appear instantly** (no polling, Convex subscription)
- [ ] Delete confirmation dialog (type name to confirm)

**Deliverable:** Live deployment list.

### Phase 4.6 -- New Deployment Wizard UI

- [ ] `app/(dashboard)/deployments/new/page.tsx` -- multi-step form:
  - **Step 1 -- Service Type:** Convex (selectable), Postgres/SpaceTimeDB (greyed, "Coming Soon")
  - **Step 2 -- Configuration:** Name input with live subdomain preview, port assignment (auto/manual)
  - **Step 3 -- Review:** Summary of name, type, ports, domain URLs. "Create Deployment" button.
  - **Step 4 -- Progress:** Real-time progress (Creating DNS -> Starting containers -> Retrieving credentials) driven by Convex subscription on deployment status
  - **Step 5 -- Success:** Admin key (copy, shown-once warning), domain URLs (copy + links), "Open Dashboard" button
- [ ] Form validation via react-hook-form + Zod
- [ ] Error state: show failure, offer retry

**Deliverable:** Complete creation flow with real-time progress.

### Phase 4.7 -- Deployment Detail UI

- [ ] `app/(dashboard)/deployments/[id]/page.tsx` -- tabbed layout:
  - **Overview:** Status (real-time), quick actions (start/stop/restart), containers card, credentials card (masked + reveal), domain URLs card, port mappings
  - **Logs** (`/[id]/logs`): Container selector, tail count, monospace log output, refresh
  - **Metrics** (`/[id]/metrics`): Per-container CPU% and RAM cards (placeholder for charts)
  - **Domains:** Subdomain table with CF/NPM status, re-create/remove buttons
  - **Settings** (`/[id]/settings`): Read-only config, danger zone (stop, delete with confirmation)

**Deliverable:** Full deployment management UI.

---

## Milestone 5: Monitoring & Observability

> **Goal:** Live metrics charts, container log streaming, dashboard overview with aggregate stats, audit trail.

### Phase 5.1 -- Metrics API & Charts

- [ ] Infra agent: `GET /infra/metrics/containers` already returns per-container stats
- [ ] Install shadcn chart component (Recharts-based)
- [ ] `components/metrics/stat-card.tsx` -- card with label, value, unit, trend
- [ ] `components/metrics/cpu-chart.tsx` -- line chart, polls every 5s, rolling 5-min window
- [ ] `components/metrics/memory-chart.tsx` -- area chart, used vs limit
- [ ] Wire into deployment detail Metrics tab + system page

**Deliverable:** Visual metrics on deployment detail and system pages.

### Phase 5.2 -- Dashboard Overview

- [ ] `app/(dashboard)/page.tsx` -- overview:
  - Stat cards: Total Deployments, Running, Stopped, Error (real-time via Convex)
  - System health: CPU%, RAM%, Disk% (gauge cards, polled from infra agent)
  - Recent deployments: last 5, real-time status
  - Infrastructure status: Cloudflare, NPM, wildcard cert
- [ ] Skeleton loaders while fetching
- [ ] System metrics auto-refresh every 10s

**Deliverable:** Landing page with instant overview.

### Phase 5.3 -- Log Streaming

- [ ] Infra agent: `GET /infra/containers/:id/logs?follow=true` -- SSE endpoint using dockerode stream
- [ ] Update Logs tab UI:
  - Toggle: "tail" mode (fetch last N lines) vs "follow" mode (live SSE stream)
  - Follow: new lines at bottom, auto-scroll
  - Client-side search/filter
  - Clear button
- [ ] Reconnect on SSE disconnect

**Deliverable:** Live container logs in the browser.

### Phase 5.4 -- Audit Log

- [ ] Convex query: `auditLog.list(filters)` -- paginated, filterable
- [ ] `app/(dashboard)/settings/page.tsx` -- audit log section:
  - Table: Timestamp, User, Action, Resource, Details
  - Filter by action type
  - Pagination
- [ ] Real-time: new audit entries appear as they happen

**Deliverable:** Full audit trail visible.

---

## Milestone 6: Production & Polish

> **Goal:** Cloudify deployed on server via Docker Compose at its own subdomain, fully tested end-to-end.

### Phase 6.1 -- Production Dockerfiles

- [ ] `apps/web/Dockerfile` prod stage: standalone Next.js output, ~100MB
- [ ] `apps/api/Dockerfile` prod stage: compiled TS, ~150MB
- [ ] Both images tagged and pushable to registry
- [ ] Test: build locally, run via `docker-compose.prod.yml`

**Deliverable:** Production container images.

### Phase 6.2 -- Platform Setup Script

- [ ] Script/ansible that provisions Cloudify's infrastructure:
  1. Start cloudify-postgres + cloudify-convex via compose
  2. Wait for health
  3. Run `npx convex deploy` to push schema + functions
  4. Generate admin key for Cloudify's own Convex
  5. Create Cloudflare A record: `cloudify.devhomelab.org`
  6. Create NPM proxy hosts for web + API
- [ ] Idempotent: safe to re-run

**Deliverable:** One command sets up the platform.

### Phase 6.3 -- Deploy & Validate

- [ ] Push images to registry
- [ ] Run platform setup script on server
- [ ] Deploy `docker-compose.prod.yml`
- [ ] Verify `https://cloudify.devhomelab.org` loads
- [ ] End-to-end test:
  1. Complete setup wizard
  2. Create Convex deployment "e2e-test"
  3. Verify CF records + NPM proxies created
  4. Verify `https://e2e-test.devhomelab.org` responds
  5. Verify `https://e2e-test-dash.devhomelab.org` loads dashboard
  6. Log in to Convex dashboard with admin key
  7. Stop, start, restart from Cloudify UI
  8. Check metrics and logs
  9. Delete -- verify full cleanup (containers, DNS, NPM, ports)
- [ ] Verify existing aegis + SevarthiProjectHub deployments coexist

**Deliverable:** Platform live and validated.

### Phase 6.4 -- Error Handling & Hardening

- [ ] Graceful: Docker socket unavailable
- [ ] Graceful: Cloudflare API down (deployment created, domains degraded)
- [ ] Graceful: NPM down (deployment created, routing degraded)
- [ ] Graceful: Port exhaustion (clear error)
- [ ] Graceful: Duplicate deployment name
- [ ] Graceful: Container crash loops (detect, surface in UI)
- [ ] Infra agent: rate limiting
- [ ] Convex actions: idempotency (retry-safe)

**Deliverable:** Robust error handling.

### Phase 6.5 -- Documentation

- [ ] `README.md` -- setup guide, prerequisites, config, first run
- [ ] `.env.example` -- fully documented
- [ ] `cloudify.config.yml` -- commented with all options
- [ ] Document: how to add a new service type (ServiceProvider + template)
- [ ] Document: how to change branding
- [ ] Document: how to switch to Convex Cloud (change one env var)

**Deliverable:** Anyone can deploy and configure Cloudify.

---

## Milestone Summary

| # | Milestone | Phases | What you get |
|---|---|---|---|
| 1 | Project Foundation | 8 | Monorepo, Convex schema, infra agent, Docker dev env |
| 2 | Auth & Dashboard Shell | 5 | Login, sidebar layout, system metrics |
| 3 | Domain Infrastructure | 4 | Cloudflare + NPM automation, health checks in UI |
| 4 | Convex Deployment Engine | 7 | Create/manage Convex instances with HTTPS domains, real-time |
| 5 | Monitoring & Observability | 4 | Charts, live logs, audit trail, dashboard overview |
| 6 | Production & Polish | 5 | Deployed, e2e tested, documented |

---

## Dependency Graph

```
M1 (Foundation)
 +-- M2 (Auth & Layout)       <- needs Convex schema + web + config
 +-- M3 (Domain Infra)        <- needs domain-manager + infra agent
      +-- M4 (Convex Engine)   <- needs domains + docker-manager + auth + UI
           +-- M5 (Monitoring) <- needs deployments to exist
                +-- M6 (Prod)  <- needs everything
```

M2 and M3 can run in parallel after M1.
