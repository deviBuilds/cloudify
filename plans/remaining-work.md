# Cloudify -- Remaining High-Impact Work

Status as of 2026-04-04. Ordered by impact and dependency.

---

## Phase A: Audit Log UI (Milestone 5.4)

**Impact:** Backend is 100% ready, all actions already write audit entries. This is pure frontend work.

### Tasks

1. Add audit log section to `/settings` page
   - Query `api.auditLog.list` from Convex
   - Table columns: Timestamp, Action, Resource Type, Resource ID, Details
   - Use existing sortable `TableHead` component
   - Show last 50 entries, paginate with "Load More"
2. Add filter dropdown by action type (create, delete, start, stop, restart)
3. Real-time updates via Convex subscription (entries appear as they happen)

### Files to modify

| File | Change |
|------|--------|
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Add audit log section with table |
| `apps/convex/convex/auditLog.ts` | May need pagination args (offset/cursor) |

### Estimate: Small

---

## Phase B: Log Streaming (Milestone 5.3)

**Impact:** Logs are currently fetch-and-forget. Live streaming is critical for debugging deployments.

### Tasks

1. Add SSE endpoint to infra agent: `GET /infra/containers/:id/logs?follow=true`
   - Use dockerode `container.logs({ follow: true })` stream
   - Pipe to SSE response with `Content-Type: text/event-stream`
   - Send heartbeat every 15s to keep connection alive
2. Add SSE proxy support in Next.js proxy route (stream response instead of buffering)
3. Update Logs tab UI in `/deployments/[id]`
   - Toggle between "Tail" mode (fetch last N) and "Follow" mode (live SSE)
   - Follow mode: auto-scroll to bottom, new lines append in real-time
   - "Pause" button to stop auto-scroll while keeping stream open
   - Client-side text filter (highlight/filter matching lines)
4. Reconnect on SSE disconnect with exponential backoff

### Files to modify

| File | Change |
|------|--------|
| `apps/api/src/routes/containers.ts` | Add SSE follow endpoint |
| `apps/web/src/app/api/proxy/infra/[...path]/route.ts` | Stream SSE responses |
| `apps/web/src/app/(dashboard)/deployments/[id]/page.tsx` | Follow mode UI |

### Estimate: Medium

---

## Phase C: Dashboard System Health (Milestone 5.2)

**Impact:** Dashboard currently shows project counts only. Surfacing system health and recent activity makes it the actual landing page.

### Tasks

1. Add system health gauges to dashboard left column (below Usage card)
   - CPU, Memory, Disk gauges reusing existing `GaugeCard` component
   - Poll every 10s from `/api/proxy/metrics/system`
   - Skeleton loaders while fetching
2. Add infrastructure connectivity card
   - Cloudflare: auto-test on load (reuse `validateCloudflare` action)
   - Show green/red status dot + label
3. Add "Recent Activity" card below projects
   - Query `api.auditLog.list` (last 5 entries)
   - Show: time ago, action icon, resource name
   - Real-time via Convex subscription

### Files to modify

| File | Change |
|------|--------|
| `apps/web/src/app/(dashboard)/page.tsx` | Add gauges, infra status, recent activity |

### Estimate: Medium

---

## Phase D: Metrics Time-Series Charts (Milestone 5.1)

**Impact:** Current metrics are point-in-time snapshots. Charts show trends and help spot issues before they become incidents.

### Tasks

1. Install Recharts (`pnpm add recharts -F @cloudify/web`)
2. Create chart components in `apps/web/src/components/metrics/`
   - `cpu-chart.tsx` -- line chart, rolling 5-min window, polls every 5s
   - `memory-chart.tsx` -- area chart, used vs limit
   - Both components maintain an in-memory ring buffer of data points (no backend storage needed)
3. Wire into deployment detail Metrics tab
   - Replace current bar-style CPU/memory display with charts per container
   - Keep existing gauge cards as summary above charts
4. Wire into System page
   - Add CPU + Memory trend charts below the gauge row

### Files to modify/create

| File | Change |
|------|--------|
| `apps/web/package.json` | Add recharts dependency |
| `apps/web/src/components/metrics/cpu-chart.tsx` | New -- line chart component |
| `apps/web/src/components/metrics/memory-chart.tsx` | New -- area chart component |
| `apps/web/src/app/(dashboard)/deployments/[id]/page.tsx` | Use charts in Metrics tab |
| `apps/web/src/app/(dashboard)/system/page.tsx` | Add trend charts |

### Estimate: Medium

---

## Phase E: Production Hardening (Milestone 6.1, 6.4, 6.5)

**Impact:** Missing Dockerfile blocks containerized deployment of the web app. Error handling gaps can cause silent failures.

### Tasks

1. **Web Dockerfile** (`apps/web/Dockerfile`)
   - Multi-stage: deps -> builder -> prod
   - Next.js standalone output mode for minimal image (~100MB)
   - Copy `public/`, `.next/standalone/`, `.next/static/`
2. **Error handling improvements**
   - Port exhaustion: check remaining ports before allocation, return clear error
   - Cloudflare/NPM: add timeout (10s) and single retry on transient failures
   - Surface degraded status in UI when DNS/proxy partially fails
3. **Root README.md**
   - Prerequisites (Node 24, pnpm, Docker, Cloudflare account, NPM instance)
   - Quick start (clone, env setup, `pnpm dev`)
   - Production deployment steps
   - Architecture overview (link to `plans/architecture-plan.md`)
4. **Comment cloudify.config.yml** -- add inline docs for every field

### Files to create/modify

| File | Change |
|------|--------|
| `apps/web/Dockerfile` | New -- multi-stage production build |
| `packages/domain-manager/src/cloudflare.ts` | Add timeout + retry |
| `packages/domain-manager/src/nginx-proxy.ts` | Add timeout + retry |
| `apps/convex/convex/portAllocations.ts` | Port exhaustion check |
| `README.md` | New -- root setup guide |
| `cloudify.config.yml` | Add inline comments |

### Estimate: Medium-Large

---

## Execution Order

```
Phase A (Audit Log UI)          -- no dependencies, quickest win
  |
Phase B (Log Streaming)         -- independent, high user value
  |
Phase C (Dashboard Health)      -- depends on Phase A for recent activity
  |
Phase D (Metrics Charts)        -- independent, can parallel with C
  |
Phase E (Production Hardening)  -- do last, wraps up loose ends
```

Phases A and B can run in parallel. Phases C and D can run in parallel after A.

---

## Out of Scope (Deferred)

- Ansible/IaC platform provisioning (current manual + deploy.sh is sufficient)
- Formal e2e test suite (manual testing adequate for current scale)
- K8s Helm chart (Docker Compose + PM2 covers current needs)
- Postgres/SpaceTimeDB service types (Phase 2/3 of product roadmap)
