#!/usr/bin/env bash
set -euo pipefail

echo "=== Cloudify Dev Setup ==="

# 1. Install and build packages
echo "[1/5] Installing dependencies..."
bun install

echo "[2/5] Building packages..."
bunx turbo build --filter=@cloudify/shared --filter=@cloudify/docker-manager --filter=@cloudify/domain-manager

# 3. Start infrastructure
echo "[3/5] Starting Cloudify infrastructure (Postgres + Convex)..."
docker compose -f docker/docker-compose.dev.yml up -d cloudify-postgres cloudify-convex

# 4. Wait for Convex health
echo "[4/5] Waiting for Convex backend to be ready..."
RETRIES=30
until curl -sf http://localhost:${CLOUDIFY_CONVEX_PORT:-3211}/version > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: Convex backend did not become healthy in time."
    echo "Check logs: docker compose -f docker/docker-compose.dev.yml logs cloudify-convex"
    exit 1
  fi
  sleep 2
done
echo "Convex backend ready."

# 5. Start API
echo "[5/5] Starting infra agent..."
docker compose -f docker/docker-compose.dev.yml up -d api

echo ""
echo "=== Dev environment ready ==="
echo "  Convex Backend:  http://localhost:${CLOUDIFY_CONVEX_PORT:-3211}"
echo "  Infra Agent:     http://localhost:${API_PORT:-4000}/health"
echo ""
echo "To deploy Convex schema:"
echo "  cd apps/convex && bunx convex deploy --url http://localhost:${CLOUDIFY_CONVEX_PORT:-3211}"
