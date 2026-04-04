#!/bin/bash
set -euo pipefail

SERVER="ubuntu@146.235.212.232"
SSH_KEY="$HOME/.ssh/ssh-key-2025-08-02.key"
APP_DIR="/opt/cloudify/app"
ADMIN_KEY="convex-self-hosted|01456ef50ad7eff07021dbd2c5ee82a89ff86016ca063784acaaa8159d831db02174151a8c"
SSH="ssh -i $SSH_KEY $SERVER"
RSYNC="rsync -avz -e 'ssh -i $SSH_KEY'"

cd "$(git rev-parse --show-toplevel)"

echo "=== Building all packages ==="
NEXT_PUBLIC_CONVEX_URL=https://convex.projectinworks.com npx turbo build --force

echo ""
echo "=== Syncing shared packages ==="
rsync -avz -e "ssh -i $SSH_KEY" packages/shared/dist/ "$SERVER:$APP_DIR/packages/shared/dist/"
rsync -avz -e "ssh -i $SSH_KEY" packages/domain-manager/dist/ "$SERVER:$APP_DIR/packages/domain-manager/dist/"
rsync -avz -e "ssh -i $SSH_KEY" packages/docker-manager/dist/ "$SERVER:$APP_DIR/packages/docker-manager/dist/"

echo ""
echo "=== Syncing API ==="
rsync -avz -e "ssh -i $SSH_KEY" apps/api/dist/ "$SERVER:$APP_DIR/apps/api/dist/"

echo ""
echo "=== Syncing Web ==="
rsync -avz --delete -e "ssh -i $SSH_KEY" apps/web/.next/ "$SERVER:$APP_DIR/apps/web/.next/"

echo ""
echo "=== Syncing Convex functions ==="
rsync -avz -e "ssh -i $SSH_KEY" apps/convex/convex/ "$SERVER:$APP_DIR/apps/convex/convex/"

echo ""
echo "=== Syncing config ==="
rsync -avz -e "ssh -i $SSH_KEY" cloudify.config.yml "$SERVER:$APP_DIR/cloudify.config.yml"

echo ""
echo "=== Deploying Convex functions ==="
$SSH "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && \
  cd $APP_DIR/apps/convex && \
  npx convex deploy --url http://localhost:3213 --admin-key '$ADMIN_KEY'"

echo ""
echo "=== Restarting services ==="
$SSH "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && \
  cd $APP_DIR && pm2 restart ecosystem.config.cjs && pm2 save"

echo ""
echo "=== Deploy complete ==="
