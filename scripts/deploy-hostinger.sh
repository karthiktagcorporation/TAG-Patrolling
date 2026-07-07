#!/usr/bin/env bash
# Deploy/update TAG-Patrolling on a Hostinger Ubuntu VPS.
# Run this FROM the server, inside the app directory, after `git pull`.
# See DEPLOYMENT.md for first-time setup (Node/PM2/Nginx install, etc).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Installing dependencies"
npm install --prefix server
npm install --prefix client

echo "==> Applying Prisma migrations"
npm run prisma:migrate --prefix server -- --name deploy 2>/dev/null || \
  (cd server && npx prisma migrate deploy)

echo "==> Building server and client"
npm run build

echo "==> Reloading PM2 process"
if pm2 describe tag-patrolling-server > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi

pm2 save

echo "==> Done. Check status with: pm2 status"
