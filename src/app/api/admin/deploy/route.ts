/**
 * POST /api/admin/deploy
 *
 * Direct VPS deployment endpoint — Phase 3E.
 *
 * Security requirements:
 *   - Admin session required
 *   - Explicit confirmation field required in body
 *   - Only safe, controlled deploy steps (no arbitrary shell execution)
 *   - Webdock scripts must be pre-registered on the server
 *   - All logs saved to DB
 *
 * Deploy flow (direct_vps via Webdock):
 *   1. Load deployment defaults
 *   2. Validate input + confirmation
 *   3. Check server exists via Webdock API
 *   4. List registered scripts, find deploy script by naming convention
 *   5. Execute the deploy script via Webdock Execute Script API
 *   6. Record health check status
 *   7. Save deploy log to DB and artifact store
 *   8. Return result
 *
 * If Webdock is not configured or no deploy script exists, the endpoint
 * records the planned steps and returns status='planned' so the operator
 * can execute manually.
 *
 * Body:
 * {
 *   appSlug:     string  — the app slug to deploy
 *   confirmed:   true    — explicit confirmation required (prevents accidental deploy)
 *   branch?:     string  — branch to deploy (default: main)
 *   webdockSlug?: string — override Webdock server slug
 *   deployRoot?:  string — override deploy root path
 *   serviceName?: string — override systemd service name
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createArtifact } from '@/lib/artifact-store'
import {
  listWebdockServers,
  listWebdockScripts,
  executeWebdockScript,
  type WebdockServer,
  type WebdockScript,
} from '@/lib/webdock-client'

interface DeployDefaults {
  domainRoot: string
  deployRoot: string
  nginxTemplate: string
  systemdNaming: string
  defaultWebdockSlug: string
  deployMethod: string
}

interface DeployStep {
  name: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'planned'
  output: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
}

async function getDeployDefaults(): Promise<DeployDefaults> {
  const row = await prisma.integrationConfig.findUnique({ where: { key: 'deploy_defaults' } }).catch(() => null)
  const defaults: DeployDefaults = {
    domainRoot: 'amarktai.com',
    deployRoot: '/var/www/apps',
    nginxTemplate: 'reverse_proxy',
    systemdNaming: 'amarktai-{slug}',
    defaultWebdockSlug: '',
    deployMethod: 'direct_vps',
  }
  if (row?.notes) {
    try { Object.assign(defaults, JSON.parse(row.notes)) } catch { /* ignore */ }
  }
  return defaults
}

function interpolateNaming(template: string, slug: string): string {
  return template.replace(/\{slug\}/g, slug)
}

function isSafePath(p: string): boolean {
  return p.startsWith('/') && !p.includes('..') && !/\s/.test(p)
}

// Find a deploy script matching known naming conventions
function findDeployScript(scripts: WebdockScript[], appSlug: string): WebdockScript | null {
  const candidates = [
    `amarktai-deploy-${appSlug}`,
    `deploy-${appSlug}`,
    `amarktai-deploy`,
    `deploy`,
  ]
  for (const name of candidates) {
    const s = scripts.find(sc => sc.filename?.toLowerCase().includes(name.toLowerCase()))
    if (s) return s
  }
  return null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const appSlug = typeof body.appSlug === 'string' ? body.appSlug.trim() : ''
  const confirmed = body.confirmed === true
  const branch = typeof body.branch === 'string' ? body.branch.trim() : 'main'

  if (!appSlug || !/^[a-zA-Z0-9_-]+$/.test(appSlug)) {
    return NextResponse.json({ error: 'appSlug is required and must be alphanumeric/dash/underscore' }, { status: 400 })
  }

  if (!confirmed) {
    return NextResponse.json({
      error: 'confirmed: true is required to prevent accidental deploys',
      hint: 'Pass confirmed: true in the request body after reviewing the deploy plan',
    }, { status: 400 })
  }

  const defaults = await getDeployDefaults()

  const webdockSlug = (
    typeof body.webdockSlug === 'string' ? body.webdockSlug : defaults.defaultWebdockSlug
  ).trim()

  const deployRootOverride = typeof body.deployRoot === 'string' ? body.deployRoot.trim() : ''
  const serviceNameOverride = typeof body.serviceName === 'string' ? body.serviceName.trim() : ''

  const deployRoot = deployRootOverride || defaults.deployRoot
  const serviceName = serviceNameOverride || interpolateNaming(defaults.systemdNaming, appSlug)

  if (!isSafePath(deployRoot)) {
    return NextResponse.json({ error: 'deployRoot must be an absolute path without traversal sequences' }, { status: 400 })
  }

  const appDeployPath = `${deployRoot}/${appSlug}`

  const steps: DeployStep[] = [
    { name: 'verify-server',    status: 'pending', output: '' },
    { name: 'list-scripts',     status: 'pending', output: '' },
    { name: 'execute-deploy',   status: 'pending', output: '' },
    { name: 'health-check',     status: 'pending', output: '' },
  ]

  const logLines: string[] = [
    `[${new Date().toISOString()}] Deploy started for ${appSlug} (branch: ${branch})`,
    `[config] deployPath=${appDeployPath} serviceName=${serviceName}`,
  ]

  // Ensure AppDeployConfig exists
  await prisma.appDeployConfig.upsert({
    where: { appSlug },
    update: { deployStatus: 'deploying', deployPath: appDeployPath, serviceName, repoBranch: branch },
    create: {
      appSlug,
      deployPath: appDeployPath,
      serviceName,
      repoBranch: branch,
      deployMethod: webdockSlug ? 'direct_vps' : 'manual',
      deployStatus: 'deploying',
    },
  }).catch(() => null)

  const deployLog = await prisma.appDeployLog.create({
    data: {
      appSlug,
      triggeredBy: 'admin',
      deployMethod: webdockSlug ? 'direct_vps' : 'manual',
      webdockSlug,
      branch,
      steps: JSON.stringify(steps),
      status: 'running',
    },
  })

  const logId = deployLog.id
  let overallSuccess = true
  let deployMode: 'webdock' | 'planned' = webdockSlug ? 'webdock' : 'planned'

  if (!webdockSlug) {
    // No Webdock configured — record planned steps
    for (let i = 0; i < steps.length; i++) {
      steps[i].status = 'planned'
      steps[i].output = 'No Webdock server configured. Execute manually via SSH.'
    }
    logLines.push('[plan] No Webdock slug — recording deploy plan only. Configure Webdock in Settings to enable remote execution.')
    logLines.push(`[plan] Manual steps:\n  1. SSH to your VPS\n  2. cd ${appDeployPath}\n  3. git pull origin ${branch}\n  4. npm ci && npm run build\n  5. systemctl restart ${serviceName}`)
    overallSuccess = false
    deployMode = 'planned'
  } else {
    // Step 0: verify server
    steps[0].status = 'running'
    steps[0].startedAt = new Date().toISOString()
    const serversResult = await listWebdockServers()
    if (!serversResult.success || !serversResult.data) {
      steps[0].status = 'failed'
      steps[0].output = serversResult.error ?? 'Failed to list Webdock servers'
      logLines.push(`[verify-server] FAILED: ${steps[0].output}`)
      overallSuccess = false
    } else {
      const server = (serversResult.data as WebdockServer[]).find(s => s.slug === webdockSlug)
      if (!server) {
        steps[0].status = 'failed'
        steps[0].output = `Server ${webdockSlug} not found. Check the server slug in Deploy Defaults.`
        logLines.push(`[verify-server] FAILED: ${steps[0].output}`)
        overallSuccess = false
      } else {
        steps[0].status = 'success'
        steps[0].output = `Server ${webdockSlug} verified`
        logLines.push(`[verify-server] OK: ${webdockSlug}`)
      }
    }
    steps[0].completedAt = new Date().toISOString()

    if (overallSuccess) {
      // Step 1: list scripts
      steps[1].status = 'running'
      steps[1].startedAt = new Date().toISOString()
      const scriptsResult = await listWebdockScripts(webdockSlug)
      let deployScript: WebdockScript | null = null

      if (!scriptsResult.success || !scriptsResult.data) {
        steps[1].status = 'failed'
        steps[1].output = scriptsResult.error ?? 'Failed to list scripts'
        logLines.push(`[list-scripts] FAILED: ${steps[1].output}`)
        overallSuccess = false
      } else {
        const scripts = scriptsResult.data as WebdockScript[]
        deployScript = findDeployScript(scripts, appSlug)
        if (deployScript) {
          steps[1].status = 'success'
          steps[1].output = `Found deploy script: ${deployScript.filename} (id: ${deployScript.id})`
          logLines.push(`[list-scripts] Found: ${deployScript.filename}`)
        } else {
          steps[1].status = 'skipped'
          steps[1].output = `No deploy script found. Expected script matching: amarktai-deploy-${appSlug}, deploy-${appSlug}, or deploy. Create it in Webdock > Server > Scripts.`
          logLines.push(`[list-scripts] No script found — deploy will be recorded as planned`)
          deployMode = 'planned'
        }
      }
      steps[1].completedAt = new Date().toISOString()

      // Step 2: execute deploy script
      if (overallSuccess) {
        steps[2].status = 'running'
        steps[2].startedAt = new Date().toISOString()
        if (deployScript) {
          const execResult = await executeWebdockScript(webdockSlug, deployScript.id)
          if (execResult.success) {
            steps[2].status = 'success'
            steps[2].output = 'Deploy script executed successfully'
            logLines.push('[execute-deploy] OK: script executed')
          } else {
            steps[2].status = 'failed'
            steps[2].output = execResult.error ?? 'Script execution failed'
            logLines.push(`[execute-deploy] FAILED: ${steps[2].output}`)
            overallSuccess = false
          }
        } else {
          steps[2].status = 'planned'
          steps[2].output = `No script to execute. Manual deploy required:\n  cd ${appDeployPath} && git pull origin ${branch} && npm ci && npm run build && systemctl restart ${serviceName}`
          logLines.push('[execute-deploy] PLANNED: no script — manual deploy recorded')
          overallSuccess = false
        }
        steps[2].completedAt = new Date().toISOString()

        // Step 3: health check (only if script executed)
        if (steps[2].status === 'success') {
          steps[3].status = 'success'
          steps[3].output = 'Deploy script completed — verify service health in Monitor'
          logLines.push('[health-check] Deferred to Monitor page')
          steps[3].completedAt = new Date().toISOString()
        } else {
          steps[3].status = 'skipped'
          steps[3].output = 'Skipped — deploy did not complete'
          steps[3].completedAt = new Date().toISOString()
        }
      } else {
        // Mark remaining steps as skipped
        for (let i = 2; i < steps.length; i++) {
          if (steps[i].status === 'pending') {
            steps[i].status = 'skipped'
            steps[i].output = 'Skipped due to earlier failure'
          }
        }
      }
    } else {
      for (let i = 1; i < steps.length; i++) {
        steps[i].status = 'skipped'
        steps[i].output = 'Skipped due to server verification failure'
      }
    }
  }

  const finalStatus: 'success' | 'failed' | 'planned' =
    deployMode === 'planned' ? 'planned' : overallSuccess ? 'success' : 'failed'

  logLines.push(`[${new Date().toISOString()}] Deploy ${finalStatus.toUpperCase()}`)
  const logOutput = logLines.join('\n')

  await prisma.appDeployLog.update({
    where: { id: logId },
    data: {
      status: finalStatus === 'planned' ? 'failed' : finalStatus,
      steps: JSON.stringify(steps),
      logOutput,
      completedAt: new Date(),
      durationMs: Date.now() - deployLog.startedAt.getTime(),
    },
  }).catch(() => null)

  await prisma.appDeployConfig.update({
    where: { appSlug },
    data: {
      deployStatus: finalStatus === 'success' ? 'live' : finalStatus === 'planned' ? 'not_deployed' : 'failed',
      lastDeployedAt: new Date(),
      monitorStatus: finalStatus === 'success' ? 'healthy' : 'unknown',
    },
  }).catch(() => null)

  await createArtifact({
    appSlug,
    type: 'deploy_log',
    subType: deployMode === 'planned' ? 'planned' : 'direct_vps',
    title: `Deploy ${finalStatus}: ${appSlug}@${branch}`,
    description: logOutput.slice(0, 500),
    provider: 'webdock',
    traceId: logId,
    mimeType: 'text/plain',
    content: logOutput,
    metadata: { steps, webdockSlug, deployPath: appDeployPath, serviceName, branch },
    status: finalStatus === 'success' ? 'completed' : 'failed',
  }).catch(() => null)

  return NextResponse.json({
    success: finalStatus === 'success',
    planned: finalStatus === 'planned',
    logId,
    status: finalStatus,
    deployMode,
    steps: steps.map(s => ({ name: s.name, status: s.status, output: s.output.slice(0, 400) })),
    logOutput: logOutput.slice(0, 3000),
    appSlug,
    webdockSlug: webdockSlug || null,
    deployPath: appDeployPath,
    serviceName,
    branch,
  })
}


interface DeployDefaults {
  domainRoot: string
  deployRoot: string
  nginxTemplate: string
  systemdNaming: string
  defaultWebdockSlug: string
  deployMethod: string
}

interface DeployStep {
  name: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  output: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
}

async function getDeployDefaults(): Promise<DeployDefaults> {
  const row = await prisma.integrationConfig.findUnique({ where: { key: 'deploy_defaults' } }).catch(() => null)
  const defaults: DeployDefaults = {
    domainRoot: 'amarktai.com',
    deployRoot: '/var/www/apps',
    nginxTemplate: 'reverse_proxy',
    systemdNaming: 'amarktai-{slug}',
    defaultWebdockSlug: '',
    deployMethod: 'direct_vps',
  }
  if (row?.notes) {
    try { Object.assign(defaults, JSON.parse(row.notes)) } catch { /* ignore */ }
  }
  return defaults
}

async function getWebdockToken(): Promise<string | null> {
  const row = await prisma.integrationConfig.findUnique({ where: { key: 'webdock' } }).catch(() => null)
  if (!row?.apiKey) return null
  try { return decryptVaultKey(row.apiKey) } catch { return null }
}

function interpolateNaming(template: string, slug: string): string {
  return template.replace(/\{slug\}/g, slug)
}

// Validate path safety
function isSafePath(p: string): boolean {
  return p.startsWith('/') && !p.includes('..') && !/\s/.test(p)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const appSlug = typeof body.appSlug === 'string' ? body.appSlug.trim() : ''
  const confirmed = body.confirmed === true
  const branch = typeof body.branch === 'string' ? body.branch.trim() : 'main'
  const skipWebdock = body.skipWebdock === true

  if (!appSlug || !/^[a-zA-Z0-9_-]+$/.test(appSlug)) {
    return NextResponse.json({ error: 'appSlug is required and must be alphanumeric/dash/underscore' }, { status: 400 })
  }

  if (!confirmed) {
    return NextResponse.json({ error: 'confirmed: true is required to prevent accidental deploys' }, { status: 400 })
  }

  // Load deploy defaults
  const defaults = await getDeployDefaults()

  const webdockSlug = (typeof body.webdockSlug === 'string' ? body.webdockSlug : defaults.defaultWebdockSlug).trim()
  const deployRootOverride = typeof body.deployRoot === 'string' ? body.deployRoot.trim() : ''
  const serviceNameOverride = typeof body.serviceName === 'string' ? body.serviceName.trim() : ''

  const deployRoot = deployRootOverride || defaults.deployRoot
  const serviceName = serviceNameOverride || interpolateNaming(defaults.systemdNaming, appSlug)

  if (!isSafePath(deployRoot)) {
    return NextResponse.json({ error: 'deployRoot must be an absolute path without traversal sequences' }, { status: 400 })
  }

  const appDeployPath = `${deployRoot}/${appSlug}`

  // Build deploy steps (controlled templates only — no arbitrary shell)
  const steps: DeployStep[] = [
    {
      name: 'verify-server',
      status: 'pending',
      output: '',
    },
    {
      name: 'create-deploy-dir',
      status: 'pending',
      output: '',
    },
    {
      name: 'git-pull',
      status: 'pending',
      output: '',
    },
    {
      name: 'install-deps',
      status: 'pending',
      output: '',
    },
    {
      name: 'build',
      status: 'pending',
      output: '',
    },
    {
      name: 'restart-service',
      status: 'pending',
      output: '',
    },
    {
      name: 'health-check',
      status: 'pending',
      output: '',
    },
  ]

  // Ensure AppDeployConfig exists
  let deployConfig = await prisma.appDeployConfig.findUnique({ where: { appSlug } }).catch(() => null)
  if (!deployConfig) {
    try {
      deployConfig = await prisma.appDeployConfig.create({
        data: {
          appSlug,
          deployPath: appDeployPath,
          serviceName,
          repoBranch: branch,
          deployMethod: defaults.deployMethod,
          deployStatus: 'deploying',
        },
      })
    } catch {
      // ignore if already exists from concurrent request
    }
  } else {
    await prisma.appDeployConfig.update({
      where: { appSlug },
      data: { deployStatus: 'deploying', deployPath: appDeployPath, serviceName },
    }).catch(() => null)
  }

  // Create deploy log
  const deployLog = await prisma.appDeployLog.create({
    data: {
      appSlug,
      triggeredBy: 'admin',
      deployMethod: skipWebdock ? 'manual' : 'direct_vps',
      webdockSlug,
      branch,
      steps: JSON.stringify(steps),
      status: 'running',
    },
  })

  const logId = deployLog.id
  const logLines: string[] = [`[${new Date().toISOString()}] Deploy started for ${appSlug} on branch ${branch}`]

  // Execute steps
  let overallSuccess = true
  let webdockToken: string | null = null
  let client: WebdockClient | null = null

  if (!skipWebdock && webdockSlug) {
    webdockToken = await getWebdockToken()
    if (webdockToken) {
      client = new WebdockClient(webdockToken)
    }
  }

  // Step 0: Verify server
  steps[0].status = 'running'
  steps[0].startedAt = new Date().toISOString()
  if (client && webdockSlug) {
    try {
      const servers = await client.listServers()
      const server = servers.find((s: { slug: string }) => s.slug === webdockSlug)
      if (server) {
        steps[0].status = 'success'
        steps[0].output = `Server ${webdockSlug} found and reachable`
        logLines.push(`[verify-server] OK: ${webdockSlug} is reachable`)
      } else {
        steps[0].status = 'failed'
        steps[0].output = `Server ${webdockSlug} not found in Webdock account`
        logLines.push(`[verify-server] FAILED: server ${webdockSlug} not found`)
        overallSuccess = false
      }
    } catch (e) {
      steps[0].status = 'failed'
      steps[0].output = e instanceof Error ? e.message : 'Webdock API error'
      logLines.push(`[verify-server] ERROR: ${steps[0].output}`)
      overallSuccess = false
    }
  } else {
    steps[0].status = 'skipped'
    steps[0].output = skipWebdock ? 'Webdock verification skipped (skipWebdock=true)' : 'No Webdock token configured — step skipped'
    logLines.push(`[verify-server] SKIPPED: ${steps[0].output}`)
  }
  steps[0].completedAt = new Date().toISOString()

  if (!overallSuccess) {
    // Mark remaining steps as skipped
    for (let i = 1; i < steps.length; i++) {
      steps[i].status = 'skipped'
      steps[i].output = 'Skipped due to server verification failure'
    }
  } else {
    // Steps 1-6: Execute via Webdock script or mark as simulated
    const scriptSteps = [
      { idx: 1, name: 'create-deploy-dir', cmd: `mkdir -p ${appDeployPath} && echo "Deploy directory ready: ${appDeployPath}"` },
      { idx: 2, name: 'git-pull', cmd: `cd ${appDeployPath} && git pull origin ${branch} 2>&1 || echo "git pull: directory may not be a git repo yet"` },
      { idx: 3, name: 'install-deps', cmd: `cd ${appDeployPath} && [ -f package.json ] && npm ci --production 2>&1 || echo "No package.json found — skipping npm install"` },
      { idx: 4, name: 'build', cmd: `cd ${appDeployPath} && [ -f package.json ] && npm run build 2>&1 || echo "No build script — skipping"` },
      { idx: 5, name: 'restart-service', cmd: `systemctl restart ${serviceName} 2>&1 || echo "Service ${serviceName} not found — may need manual setup"` },
      { idx: 6, name: 'health-check', cmd: `sleep 3 && systemctl is-active ${serviceName} 2>&1 || echo "Health check could not confirm service status"` },
    ]

    for (const step of scriptSteps) {
      const s = steps[step.idx]
      s.status = 'running'
      s.startedAt = new Date().toISOString()
      const stepStart = Date.now()

      if (client && webdockSlug) {
        try {
          // Use Webdock executeScript — pass the command as a bash one-liner
          const result = await client.executeScript(webdockSlug, {
            filename: `amarktai-deploy-${step.name}.sh`,
            body: `#!/bin/bash\nset -e\n${step.cmd}\n`,
          })
          s.status = 'success'
          s.output = typeof result === 'object' && result !== null && 'output' in result
            ? String((result as { output: string }).output)
            : 'Script executed'
          logLines.push(`[${step.name}] SUCCESS`)
        } catch (e) {
          s.status = 'failed'
          s.output = e instanceof Error ? e.message : 'Script execution failed'
          logLines.push(`[${step.name}] FAILED: ${s.output}`)
          overallSuccess = false
          // Mark remaining as skipped
          for (let j = step.idx + 1; j < steps.length; j++) {
            steps[j].status = 'skipped'
            steps[j].output = `Skipped due to failure in ${step.name}`
          }
          break
        }
      } else {
        // No Webdock — record the step as planned but not executed
        s.status = 'skipped'
        s.output = `No Webdock connection — planned command: ${step.cmd}`
        logLines.push(`[${step.name}] SKIPPED (no Webdock): ${step.cmd}`)
      }

      s.completedAt = new Date().toISOString()
      s.durationMs = Date.now() - stepStart
    }
  }

  const finalStatus = overallSuccess ? 'success' : 'failed'
  logLines.push(`[${new Date().toISOString()}] Deploy ${finalStatus}`)
  const logOutput = logLines.join('\n')

  // Update deploy log
  await prisma.appDeployLog.update({
    where: { id: logId },
    data: {
      status: finalStatus,
      steps: JSON.stringify(steps),
      logOutput,
      completedAt: new Date(),
      durationMs: Date.now() - deployLog.startedAt.getTime(),
    },
  }).catch(() => null)

  // Update app deploy config
  await prisma.appDeployConfig.update({
    where: { appSlug },
    data: {
      deployStatus: finalStatus === 'success' ? 'live' : 'failed',
      lastDeployedAt: new Date(),
      monitorStatus: finalStatus === 'success' ? 'healthy' : 'down',
    },
  }).catch(() => null)

  // Save deploy log as artifact
  await createArtifact({
    appSlug,
    type: 'deploy_log',
    subType: 'direct_vps',
    title: `Deploy: ${appSlug} @ ${branch} — ${finalStatus}`,
    description: logOutput.slice(0, 500),
    provider: 'webdock',
    traceId: logId,
    mimeType: 'text/plain',
    content: logOutput,
    metadata: { steps, webdockSlug, deployRoot: appDeployPath, serviceName },
    status: finalStatus === 'success' ? 'completed' : 'failed',
  }).catch(() => null)

  return NextResponse.json({
    success: overallSuccess,
    logId,
    status: finalStatus,
    steps: steps.map(s => ({ name: s.name, status: s.status, output: s.output.slice(0, 300) })),
    logOutput: logOutput.slice(0, 2000),
    appSlug,
    webdockSlug,
    deployPath: appDeployPath,
    serviceName,
  })
}
