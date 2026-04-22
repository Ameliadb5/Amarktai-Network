#!/usr/bin/env bash
# ─── AmarktAI Network — Canonical VPS Deploy Script ─────────────────────────
#
# Usage (run as root or with sudo):
#   sudo bash /var/www/amarktai/repo/scripts/deploy_vps.sh
#
# Requirements:
#   - Service user must own /var/www/amarktai/repo  (or at least the .next/ subdir)
#   - Service name on this VPS: amarktai-web
#   - Node.js and npm must be on PATH
#   - DATABASE_URL must be set in /var/www/amarktai/repo/.env
#
# What this script does:
#   1. Pull latest code from git
#   2. Install all dependencies (including devDeps needed at build time)
#   3. Generate Prisma client
#   4. Push schema to DB (prisma db push — safe for SQLite / non-migration workflow)
#   5. Build the Next.js standalone app
#   6. Copy .next/static and public/ into the standalone directory
#   7. Fix ownership of the BUILD OUTPUT only (not the whole repo)
#   8. Restart the amarktai-web systemd service (non-interactively)
#   9. Verify the service is active and the health endpoints respond
#
# DOES NOT:
#   - Run recursive chown over the entire repo (avoids "Operation not permitted")
#   - Prompt for interactive authentication (must be run as root / via sudo)
#   - Use pm2 or Vercel
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/var/www/amarktai/repo"
SERVICE_NAME="amarktai-web"
SERVICE_USER="admin"
NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"

log()  { echo "[deploy] $*"; }
die()  { echo "[deploy] ERROR: $*" >&2; exit 1; }
warn() { echo "[deploy] WARNING: $*" >&2; }

# ── 0. Sanity checks ─────────────────────────────────────────────────────────
[[ -d "$APP_DIR" ]]          || die "App directory $APP_DIR not found."
[[ -f "$APP_DIR/package.json" ]] || die "package.json not found in $APP_DIR."
[[ -f "$NODE_BIN" ]]         || die "node not found on PATH."
[[ -f "$NPM_BIN" ]]          || die "npm not found on PATH."
[[ -f "$APP_DIR/.env" ]]     || warn ".env not found — service will rely on system environment."

cd "$APP_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
log "Fetching latest code..."
git fetch origin
git reset --hard origin/$(git rev-parse --abbrev-ref HEAD)
log "HEAD is now: $(git rev-parse --short HEAD)"

# ── 2. Stop the service (prevents EACCES on .next/ during rebuild) ────────────
log "Stopping $SERVICE_NAME service..."
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl stop "$SERVICE_NAME"
  log "Service stopped."
else
  log "Service was not running — continuing."
fi

# ── 3. Remove stale build ─────────────────────────────────────────────────────
log "Removing stale .next/ directory..."
rm -rf .next/

# ── 4. Install dependencies ───────────────────────────────────────────────────
# devDependencies (TypeScript, tailwindcss, postcss) are required at build time.
log "Installing dependencies..."
"$NPM_BIN" ci

# ── 5. Generate Prisma client ─────────────────────────────────────────────────
log "Generating Prisma client..."
"$NPM_BIN" exec -- prisma generate

# ── 6. Push schema to DB ──────────────────────────────────────────────────────
# prisma db push is preferred over migrate deploy for SQLite / prototype setups.
# Replace with `prisma migrate deploy` if using a migration-based workflow.
log "Pushing Prisma schema to database..."
"$NPM_BIN" exec -- prisma db push || warn "prisma db push failed — DB may not be reachable yet."

# ── 7. Build the Next.js app ──────────────────────────────────────────────────
log "Building Next.js application (standalone output)..."
"$NPM_BIN" run build

[[ -f ".next/standalone/server.js" ]] || die "Standalone server.js not found. Check next.config.mjs has output: 'standalone'."
[[ -d ".next/static" ]]               || die ".next/static not found after build."

# ── 8. Copy static assets into standalone directory ───────────────────────────
# The standalone server resolves /_next/static/ relative to its own directory:
#   .next/standalone/.next/static/
# Without this step all CSS/JS/font requests return 404.
log "Copying .next/static → .next/standalone/.next/static ..."
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static

log "Copying public/ → .next/standalone/public ..."
rm -rf .next/standalone/public
cp -r public .next/standalone/public

log "Static assets in place."

# ── 9. Fix ownership of BUILD OUTPUT only ─────────────────────────────────────
# Only change ownership of the freshly-built .next/ directory.
# Do NOT recursively chown the entire repo — that fails when files are owned
# by a different user (e.g. root or another account) and raises
# "Operation not permitted".
log "Setting ownership of .next/ to ${SERVICE_USER}..."
chown -R "${SERVICE_USER}:${SERVICE_USER}" .next/ 2>/dev/null || \
  warn "chown .next/ failed — service may still work if it already has read access."

# ── 10. Install/update systemd unit if it has changed ────────────────────────
UNIT_SRC="$APP_DIR/deploy/amarktai-web.service"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"

# Fall back to the generic unit file if a web-specific one does not exist
if [[ ! -f "$UNIT_SRC" ]]; then
  UNIT_SRC="$APP_DIR/deploy/amarktai.service"
fi

if [[ -f "$UNIT_SRC" ]]; then
  if ! diff -q "$UNIT_SRC" "$UNIT_DST" &>/dev/null 2>&1; then
    log "Updating systemd unit ${UNIT_DST} ..."
    cp "$UNIT_SRC" "$UNIT_DST"
    systemctl daemon-reload
    log "daemon-reload done."
  fi
fi

# ── 11. Start (or restart) the service ───────────────────────────────────────
log "Starting ${SERVICE_NAME} ..."
systemctl enable "${SERVICE_NAME}" --quiet 2>/dev/null || true
systemctl restart "${SERVICE_NAME}"

# ── 12. Verify the service came up ───────────────────────────────────────────
sleep 4
if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
  die "${SERVICE_NAME} failed to start. Check: journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
fi

log "${SERVICE_NAME} is active."
systemctl status "${SERVICE_NAME}" --no-pager -l --lines=20

# ── 13. Health-check endpoints ───────────────────────────────────────────────
log "Checking /api/health ..."
curl -sf --max-time 10 http://localhost:3000/api/health \
  && log "/api/health  ✓" \
  || warn "/api/health returned non-200 (app may still be warming up)"

log "Checking /api/health/ping ..."
curl -sf --max-time 10 http://localhost:3000/api/health/ping \
  && log "/api/health/ping  ✓" \
  || warn "/api/health/ping returned non-200 (app may still be warming up)"

log ""
log "══════════════════════════════════════════════════════"
log " Deploy complete."
log ""
log " Verification commands:"
log "   systemctl status ${SERVICE_NAME}"
log "   journalctl -u ${SERVICE_NAME} -f"
log "   curl http://localhost:3000/api/health"
log "   curl http://localhost:3000/api/health/ping"
log "══════════════════════════════════════════════════════"
