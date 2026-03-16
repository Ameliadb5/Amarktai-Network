#!/bin/bash
# ─────────────────────────────────────────────────────────
# Amarktai Network — Production Deploy Script
# Stack: Next.js 15 + Prisma + PostgreSQL
# ─────────────────────────────────────────────────────────

set -e

APP_DIR="/var/www/amarktai-network"
SERVICE_NAME="amarktai-network"
PORT=3000

echo "🚀 Deploying Amarktai Network..."

# Pull latest code
cd "$APP_DIR"
git pull origin main

# Install dependencies
npm ci --production=false

# Generate Prisma client
npx prisma generate

# Run DB migrations (adjust if using db push)
# npx prisma migrate deploy

# Build Next.js
npm run build

# Restart service (PM2)
pm2 restart "$SERVICE_NAME" || pm2 start npm --name "$SERVICE_NAME" -- start

echo "✅ Deployment complete. Site running on port $PORT"
