#!/bin/bash
set -euo pipefail

# --- Configuration ---
SERVER="${SSH_USER:-ubuntu}@${SSH_HOST:-146.235.212.232}"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/ssh-key-2025-08-02.key}"
APP_DIR="/opt/cloudify/app"
CONVEX_ADMIN_KEY="${CONVEX_ADMIN_KEY:-}"
CONVEX_URL="${NEXT_PUBLIC_CONVEX_URL:-https://convex.projectinworks.com}"

SSH="ssh -i $SSH_KEY $SERVER"

SKIP_BUILD=false
SKIP_CONVEX=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-convex) SKIP_CONVEX=true ;;
    --help)
      echo "Usage: deploy.sh [--skip-build] [--skip-convex]"
      echo "  --skip-build   Skip local build (use existing artifacts)"
      echo "  --skip-convex  Skip Convex function deployment"
      exit 0 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

echo "=== Testing SSH connection ==="
$SSH "echo 'Connected to $(hostname)'" || { echo "SSH connection failed"; exit 1; }

if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "=== Building all packages ==="
  NEXT_PUBLIC_CONVEX_URL="$CONVEX_URL" npx turbo build --force
fi

echo ""
echo "=== Syncing shared packages ==="
rsync -azP -e "ssh -i $SSH_KEY" packages/shared/dist/ "$SERVER:$APP_DIR/packages/shared/dist/"
rsync -azP -e "ssh -i $SSH_KEY" packages/domain-manager/dist/ "$SERVER:$APP_DIR/packages/domain-manager/dist/"
rsync -azP -e "ssh -i $SSH_KEY" packages/docker-manager/dist/ "$SERVER:$APP_DIR/packages/docker-manager/dist/"

echo ""
echo "=== Syncing API ==="
rsync -azP -e "ssh -i $SSH_KEY" apps/api/dist/ "$SERVER:$APP_DIR/apps/api/dist/"

echo ""
echo "=== Syncing Web ==="
rsync -azP --delete -e "ssh -i $SSH_KEY" apps/web/.next/ "$SERVER:$APP_DIR/apps/web/.next/"

echo ""
echo "=== Syncing config ==="
rsync -azP -e "ssh -i $SSH_KEY" cloudify.config.yml "$SERVER:$APP_DIR/cloudify.config.yml"

if [ "$SKIP_CONVEX" = false ]; then
  if [ -z "$CONVEX_ADMIN_KEY" ]; then
    echo "Warning: CONVEX_ADMIN_KEY not set, skipping Convex deploy"
  else
    echo ""
    echo "=== Syncing Convex functions ==="
    rsync -azP -e "ssh -i $SSH_KEY" apps/convex/convex/ "$SERVER:$APP_DIR/apps/convex/convex/"

    echo ""
    echo "=== Deploying Convex functions ==="
    $SSH "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && \
      cd $APP_DIR/apps/convex && \
      npx convex deploy --url http://localhost:3213 --admin-key '$CONVEX_ADMIN_KEY'"
  fi
fi

echo ""
echo "=== Restarting services ==="
$SSH "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && \
  cd $APP_DIR && pm2 restart ecosystem.config.cjs && pm2 save"

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
