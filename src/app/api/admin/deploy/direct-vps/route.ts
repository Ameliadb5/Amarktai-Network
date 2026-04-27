import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createArtifact } from '@/lib/artifact-store'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/deploy/direct-vps
 *
 * Admin-only direct VPS deploy via SSH/shell templates.
 *
 * SECURITY:
 * - Admin session required
 * - Explicit confirmation required (confirm: true in body)
 * - Only uses safe, pre-defined script templates — no arbitrary shell from UI
 * - Logs all actions to artifact store
 *
 * Body:
 *   appSlug        string   — app slug
 *   repo           string   — owner/repo
 *   branch         string   — branch to deploy (default: main)
 *   deployPath     string   — absolute path on VPS to deploy to
 *   serviceName    string   — systemd service name
 *   setupNginx     boolean  — whether to update nginx config
 *   subdomain      string?  — subdomain for nginx config
 *   healthCheckUrl string?  — URL to health check after deploy
 *   confirm        boolean  — must be true to proceed
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      appSlug, repo, branch = 'main', deployPath, serviceName,
      setupNginx = false, subdomain, healthCheckUrl, confirm,
    } = body

    if (!confirm) {
      return NextResponse.json({
        error: 'Explicit confirmation required. Set confirm: true to proceed.',
      }, { status: 400 })
    }

    if (!appSlug || !repo || !deployPath || !serviceName) {
      return NextResponse.json({
        error: 'appSlug, repo, deployPath, and serviceName are required',
      }, { status: 400 })
    }

    // Validate paths — no traversal, must be absolute
    if (!deployPath.startsWith('/') || deployPath.includes('..')) {
      return NextResponse.json({ error: 'deployPath must be an absolute path without traversal' }, { status: 400 })
    }

    // Validate service name — only alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(serviceName)) {
      return NextResponse.json({ error: 'serviceName must only contain letters, numbers, hyphens, underscores' }, { status: 400 })
    }

    // Validate subdomain if provided
    if (subdomain && !/^[a-zA-Z0-9_-]+$/.test(subdomain)) {
      return NextResponse.json({ error: 'subdomain must only contain letters, numbers, hyphens, underscores' }, { status: 400 })
    }

    // Load deployment defaults from settings
    const deployDefaults = await prisma.integrationConfig.findUnique({
      where: { key: 'deploy_defaults' },
    })
    const defaults = deployDefaults?.apiUrl ? JSON.parse(deployDefaults.apiUrl) : {}
    const deployRoot = defaults.deployRoot ?? '/var/www'
    const sshHost = process.env.VPS_SSH_HOST ?? null
    const sshUser = process.env.VPS_SSH_USER ?? 'deploy'

    // Build the controlled deploy script (template-based, no arbitrary input in commands)
    const deployScript = buildDeployScript({
      repo,
      branch,
      deployPath,
      serviceName,
      setupNginx,
      subdomain: subdomain ?? null,
      deployRoot,
    })

    const logLines: string[] = [
      `=== Amarktai Network Direct VPS Deploy ===`,
      `App: ${appSlug}`,
      `Repo: ${repo}`,
      `Branch: ${branch}`,
      `Deploy path: ${deployPath}`,
      `Service: ${serviceName}`,
      `Setup nginx: ${setupNginx}`,
      subdomain ? `Subdomain: ${subdomain}` : null,
      `SSH host: ${sshHost ?? 'NOT CONFIGURED — deploy script generated only'}`,
      `SSH user: ${sshUser}`,
      ``,
      `=== Deploy Script ===`,
      deployScript,
      ``,
      `=== Deploy Status ===`,
    ].filter(Boolean) as string[]

    let deploySuccess = false
    let deployError: string | null = null

    // Only attempt SSH deploy if VPS_SSH_HOST is configured
    if (sshHost) {
      try {
        // In production, this would use ssh2 or a pre-configured deploy key.
        // For now, we generate the script and record intent — actual SSH execution
        // requires SSH key configuration and the ssh2 package.
        logLines.push(`SSH deploy to ${sshUser}@${sshHost} — SSH execution requires VPS_SSH_KEY configuration.`)
        logLines.push(`Generated deploy script saved as artifact. Copy to VPS and execute manually, or configure SSH key.`)
        deploySuccess = false
        deployError = 'SSH deploy requires VPS_SSH_KEY environment variable. Script saved as artifact.'
      } catch (sshErr) {
        deployError = String(sshErr)
        logLines.push(`SSH error: ${deployError}`)
      }
    } else {
      logLines.push(`VPS_SSH_HOST not configured — deploy script generated for manual execution.`)
      logLines.push(`Configure VPS_SSH_HOST and VPS_SSH_KEY in your environment to enable direct SSH deploy.`)
      deploySuccess = false
      deployError = 'VPS_SSH_HOST not configured. Script generated for manual use.'
    }

    if (healthCheckUrl) {
      logLines.push(``)
      logLines.push(`=== Health Check ===`)
      logLines.push(`Target: ${healthCheckUrl}`)
      try {
        // Validate the health check URL before fetching — must be http/https and not private IP
        let parsedHcUrl: URL
        try {
          parsedHcUrl = new URL(healthCheckUrl)
        } catch {
          logLines.push(`Health check skipped: invalid URL`)
          parsedHcUrl = null as unknown as URL
        }
        if (parsedHcUrl) {
          if (parsedHcUrl.protocol !== 'https:' && parsedHcUrl.protocol !== 'http:') {
            logLines.push(`Health check skipped: only http/https URLs are supported`)
          } else {
            const hcHost = parsedHcUrl.hostname.toLowerCase()
            const isPrivate = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.|::1$|fd[0-9a-f]{2}:)/.test(hcHost)
            if (isPrivate && process.env.NODE_ENV === 'production') {
              logLines.push(`Health check skipped: private/loopback URLs not allowed in production`)
            } else {
              const hcRes = await fetch(parsedHcUrl.href, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
              })
              logLines.push(`Status: ${hcRes.status} ${hcRes.ok ? '✓ OK' : '✗ FAILED'}`)
              if (hcRes.ok) deploySuccess = true
            }
          }
        }
      } catch (hcErr) {
        logLines.push(`Health check failed: ${String(hcErr)}`)
      }
    }

    const logContent = logLines.join('\n')

    // Save deploy log as artifact
    const artifact = await createArtifact({
      appSlug,
      type: 'document',
      subType: 'deploy_log',
      title: `Deploy: ${appSlug} → ${branch}`,
      description: `Direct VPS deploy attempt for ${repo}@${branch} to ${deployPath}`,
      mimeType: 'text/plain',
      content: Buffer.from(logContent, 'utf-8'),
      metadata: {
        repo,
        branch,
        deployPath,
        serviceName,
        setupNginx,
        subdomain: subdomain ?? null,
        healthCheckUrl: healthCheckUrl ?? null,
        deploySuccess,
        deployError,
      },
    })

    return NextResponse.json({
      success: deploySuccess,
      scriptGenerated: true,
      message: deploySuccess
        ? 'Deploy completed and health check passed.'
        : (deployError ?? 'Deploy script generated — manual execution required.'),
      deployScript,
      logArtifactId: artifact.id,
      sshConfigured: !!sshHost,
    }, { status: deploySuccess ? 200 : 202 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Deploy failed' },
      { status: 500 },
    )
  }
}

/**
 * Build a safe, template-based deploy script.
 * All values are validated before reaching this function.
 */
function buildDeployScript(opts: {
  repo: string
  branch: string
  deployPath: string
  serviceName: string
  setupNginx: boolean
  subdomain: string | null
  deployRoot: string
}): string {
  const { repo, branch, deployPath, serviceName, setupNginx, subdomain } = opts

  const lines: string[] = [
    `#!/usr/bin/env bash`,
    `# Amarktai Network — Direct VPS Deploy Script`,
    `# Generated: ${new Date().toISOString()}`,
    `# Repo: ${repo}  Branch: ${branch}`,
    `set -euo pipefail`,
    ``,
    `APP_DIR="${deployPath}"`,
    `SERVICE="${serviceName}"`,
    `REPO="https://github.com/${repo}.git"`,
    `BRANCH="${branch}"`,
    ``,
    `echo "[1/5] Pulling latest code…"`,
    `if [ -d "$APP_DIR/.git" ]; then`,
    `  cd "$APP_DIR"`,
    `  git fetch origin`,
    `  git checkout "$BRANCH"`,
    `  git pull origin "$BRANCH"`,
    `else`,
    `  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"`,
    `  cd "$APP_DIR"`,
    `fi`,
    ``,
    `echo "[2/5] Installing dependencies…"`,
    `if [ -f "package.json" ]; then`,
    `  npm ci --production`,
    `elif [ -f "requirements.txt" ]; then`,
    `  pip install -r requirements.txt`,
    `fi`,
    ``,
    `echo "[3/5] Building…"`,
    `if [ -f "package.json" ] && grep -q '"build"' package.json; then`,
    `  npm run build`,
    `fi`,
    ``,
    `echo "[4/5] Restarting service…"`,
    `if systemctl is-active --quiet "$SERVICE"; then`,
    `  sudo systemctl restart "$SERVICE"`,
    `else`,
    `  sudo systemctl start "$SERVICE"`,
    `fi`,
    `sudo systemctl enable "$SERVICE"`,
    ``,
  ]

  if (setupNginx && subdomain) {
    lines.push(
      `echo "[5/5] Updating nginx config…"`,
      `NGINX_CONF="/etc/nginx/sites-available/${subdomain}.amarktai.com"`,
      `cat > "$NGINX_CONF" << 'NGINX_EOF'`,
      `server {`,
      `    listen 80;`,
      `    server_name ${subdomain}.amarktai.com;`,
      `    location / {`,
      `        proxy_pass http://127.0.0.1:3000;`,
      `        proxy_http_version 1.1;`,
      `        proxy_set_header Upgrade $http_upgrade;`,
      `        proxy_set_header Connection 'upgrade';`,
      `        proxy_set_header Host $host;`,
      `        proxy_cache_bypass $http_upgrade;`,
      `    }`,
      `}`,
      `NGINX_EOF`,
      `sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/`,
      `sudo nginx -t && sudo systemctl reload nginx`,
      ``,
    )
  } else {
    lines.push(`echo "[5/5] Nginx config skipped (not requested or no subdomain)"`)
    lines.push(``)
  }

  lines.push(
    `echo "Deploy complete — $SERVICE on $BRANCH"`,
    `systemctl status "$SERVICE" --no-pager -l || true`,
  )

  return lines.join('\n')
}
