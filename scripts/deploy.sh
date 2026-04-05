#!/bin/bash
set -euo pipefail

# --- Configuration ---
SERVER="${SSH_USER:-ubuntu}@${SSH_HOST:-146.235.212.232}"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/ssh-key-2025-08-02.key}"
APP_DIR="/opt/cloudify/app"
ENV_FILE="/opt/cloudify/.env"
CONVEX_ADMIN_KEY="${CONVEX_ADMIN_KEY:-}"
CONVEX_URL="${NEXT_PUBLIC_CONVEX_URL:-https://convex.projectinworks.com}"

SSH="ssh -i $SSH_KEY $SERVER"

SKIP_CONVEX=false

for arg in "$@"; do
  case $arg in
    --skip-convex) SKIP_CONVEX=true ;;
    --help)
      echo "Usage: deploy.sh [--skip-convex]"
      echo "  --skip-convex  Skip Convex function deployment"
      exit 0 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

echo "=== Testing SSH connection ==="
$SSH "echo 'Connected to $(hostname)'" || { echo "SSH connection failed"; exit 1; }

echo ""
echo "=== Writing .env to VPS ==="
if [ -f .env ]; then
  scp -i "$SSH_KEY" .env "$SERVER:$ENV_FILE"
  $SSH "chmod 600 $ENV_FILE"
  echo "Wrote .env to $ENV_FILE"
else
  echo "Warning: No local .env file found, skipping env write"
fi

echo ""
echo "=== Syncing compose file ==="
scp -i "$SSH_KEY" docker/docker-compose.cloudify.yml "$SERVER:$APP_DIR/docker/docker-compose.cloudify.yml"

echo ""
echo "=== Syncing config ==="
scp -i "$SSH_KEY" cloudify.config.yml "$SERVER:$APP_DIR/cloudify.config.yml"

echo ""
echo "=== Pulling latest images ==="
$SSH "cd $APP_DIR/docker && \
  docker compose --env-file $ENV_FILE -f docker-compose.cloudify.yml pull cloudify-web cloudify-api"

echo ""
echo "=== Starting containers ==="
$SSH "cd $APP_DIR/docker && \
  docker compose --env-file $ENV_FILE -f docker-compose.cloudify.yml up -d cloudify-web cloudify-api"

if [ "$SKIP_CONVEX" = false ]; then
  if [ -z "$CONVEX_ADMIN_KEY" ]; then
    echo ""
    echo "Warning: CONVEX_ADMIN_KEY not set, skipping Convex deploy"
  else
    echo ""
    echo "=== Deploying Convex schema ==="
    cd apps/convex && npx convex deploy \
      --url "$CONVEX_URL" \
      --admin-key "$CONVEX_ADMIN_KEY"
    cd "$(git rev-parse --show-toplevel)"
  fi
fi

echo ""
echo "=== Health check ==="
sleep 3
if curl -sf --max-time 10 https://projectinworks.com/ > /dev/null 2>&1; then
  echo "Health check passed"
else
  echo "Health check failed (site may still be starting)"
fi

echo ""
echo "=== Deploy complete ==="
echo "  Web: https://projectinworks.com"
echo "  API: https://projectinworks.com:4000"
