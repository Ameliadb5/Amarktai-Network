#!/usr/bin/env bash
# ─── AmarktAI Network — Production Deploy Script ───────────────────────────
#
# Usage:
#   chmod +x scripts/deploy.sh
#   sudo -u www-data bash scripts/deploy.sh
#
# This script MUST be run as the service user (www-data by default) or root.
# It handles:
#   1. Installing production dependencies
#   2. Generating Prisma client
#   3. Running database migrations
#   4. Building the Next.js app (output: standalone)
#   5. Copying .next/static and public/ into .next/standalone/
#      (Next.js standalone server expects static files relative to itself)
#   6. Setting correct file ownership/permissions
#   7. Restarting the systemd service
#
# ROOT CAUSE OF /_next/static/ 404s:
#   When `next build` runs with output: 'standalone', it writes:
#     .next/standalone/server.js  ← the runtime
#     .next/static/               ← built CSS/JS/fonts (NOT in standalone/)
#   The standalone server.js resolves /_next/static from its own __dirname:
#     .next/standalone/.next/static/
#   Without the copy step below, that directory is empty → all static 404s.
#
# ROOT CAUSE OF "Failed to find Server Action":
#   Starting the service against a partially-built or old .next/ directory
#   leaves stale server action manifests referencing non-existent chunks.
#   The solution is to stop the service, wipe .next/, rebuild, copy, restart.

set -euo pipefail

APP_DIR="/var/www/amarktai/repo"
SERVICE_NAME="amarktai"
NODE_BIN="/usr/bin/node"
NPM_BIN="/usr/bin/npm"
SERVICE_USER="www-data"

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

# ── 0. Validate environment ─────────────────────────────────────────────────
[[ -d "$APP_DIR" ]] || die "App directory $APP_DIR not found."
[[ -f "$APP_DIR/package.json" ]] || die "package.json not found in $APP_DIR."
[[ -f "$APP_DIR/.env" ]] || log "WARNING: .env not found — service will use system environment."

cd "$APP_DIR"

# ── 1. Stop the running service to avoid EACCES on .next/ ───────────────────
log "Stopping $SERVICE_NAME service..."
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl stop "$SERVICE_NAME"
  log "Service stopped."
else
  log "Service was not running."
fi

# ── 2. Wipe stale build to eliminate stale server action manifests ───────────
log "Removing stale .next/ directory..."
rm -rf .next/

# ── 3. Install production dependencies ──────────────────────────────────────
log "Installing dependencies..."
# All deps are needed: TypeScript, tailwindcss, postcss are devDependencies but
# required at build time.  Use plain `npm ci` (not --omit=dev) so the build succeeds.
"$NPM_BIN" ci

# ── 4. Generate Prisma client ────────────────────────────────────────────────
log "Generating Prisma client..."
"$NPM_BIN" exec -- prisma generate

# ── 5. Run database migrations ───────────────────────────────────────────────
log "Running database migrations..."
"$NPM_BIN" exec -- prisma migrate deploy || log "WARNING: Migration failed (DB may not be reachable yet)."

# ── 6. Build the Next.js app ─────────────────────────────────────────────────
log "Building Next.js application..."
"$NPM_BIN" run build

# Confirm standalone output was produced
[[ -f ".next/standalone/server.js" ]] || die "Standalone server.js not found after build. Check next.config.mjs has output: 'standalone'."
[[ -d ".next/static" ]] || die ".next/static directory not found after build."

# ── 7. Copy static assets into standalone directory ──────────────────────────
# The standalone server resolves /_next/static/ relative to its own location:
#   .next/standalone/.next/static/
# Without this step all CSS/JS/font requests return 404.
log "Copying .next/static → .next/standalone/.next/static..."
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static

# Copy public/ into standalone so server.js can serve public files
log "Copying public/ → .next/standalone/public..."
rm -rf .next/standalone/public
cp -r public .next/standalone/public

log "Static assets in place."

# ── 8. Fix file ownership and permissions ────────────────────────────────────
log "Setting file ownership to $SERVICE_USER..."
chown -R "$SERVICE_USER":"$SERVICE_USER" .next/ || \
  log "WARNING: chown failed (run as root or adjust SERVICE_USER in this script)."

# Ensure the runtime write paths are writable (server writes to .next/server/app)
chmod -R u+rwX .next/ 2>/dev/null || true

# ── 9. Install/update systemd unit if it differs ────────────────────────────
UNIT_SRC="$APP_DIR/deploy/amarktai.service"
UNIT_DST="/etc/systemd/system/amarktai.service"
if [[ -f "$UNIT_SRC" ]]; then
  if ! diff -q "$UNIT_SRC" "$UNIT_DST" &>/dev/null; then
    log "Updating systemd unit file..."
    cp "$UNIT_SRC" "$UNIT_DST"
    systemctl daemon-reload
  fi
fi

# ── 10. Install/update nginx config if it differs ────────────────────────────
NGINX_SRC="$APP_DIR/deploy/nginx.conf"
NGINX_DST="/etc/nginx/sites-available/amarktai"
NGINX_LINK="/etc/nginx/sites-enabled/amarktai"
if [[ -f "$NGINX_SRC" ]]; then
  if ! diff -q "$NGINX_SRC" "$NGINX_DST" &>/dev/null 2>&1; then
    log "Updating nginx config..."
    cp "$NGINX_SRC" "$NGINX_DST"
    [[ -L "$NGINX_LINK" ]] || ln -s "$NGINX_DST" "$NGINX_LINK"
    nginx -t && systemctl reload nginx && log "Nginx reloaded." || log "WARNING: nginx config test failed — not reloading."
  fi
fi

# ── 11. Start the application service ────────────────────────────────────────
log "Starting $SERVICE_NAME service..."
systemctl start "$SERVICE_NAME"
systemctl enable "$SERVICE_NAME" --quiet

# Wait a moment then verify it started
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "Service started successfully."
  systemctl status "$SERVICE_NAME" --no-pager -l
else
  die "Service failed to start. Check: journalctl -u $SERVICE_NAME -n 50"
fi

log ""
log "═══════════════════════════════════════════════════════"
log " Deploy complete. Verify:"
log "   curl -I http://localhost:3000/"
log "   curl -I http://localhost:3000/_next/static/  (should 404 without a real hash)"
log "   journalctl -u $SERVICE_NAME -f"
log "═══════════════════════════════════════════════════════"
