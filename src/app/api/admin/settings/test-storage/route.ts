/**
 * POST /api/admin/settings/test-storage
 *
 * Test artifact storage connectivity.
 * - local: always available, warns about ephemerality
 * - s3/r2: checks credentials by listing bucket
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'
import { getStorageStatus } from '@/lib/storage-driver'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Accept inline config from form (not-yet-saved values)
  let inlineDriver = ''
  let inlineBucket = ''
  let inlineRegion = ''
  let inlineEndpoint = ''
  let inlineAccessKey = ''
  let inlineSecretKey = ''
  let inlineR2Url = ''

  try {
    const body = await req.json()
    inlineDriver     = typeof body.driver     === 'string' ? body.driver.trim()     : ''
    inlineBucket     = typeof body.bucket     === 'string' ? body.bucket.trim()     : ''
    inlineRegion     = typeof body.region     === 'string' ? body.region.trim()     : ''
    inlineEndpoint   = typeof body.endpoint   === 'string' ? body.endpoint.trim()   : ''
    inlineAccessKey  = typeof body.accessKey  === 'string' ? body.accessKey.trim()  : ''
    inlineSecretKey  = typeof body.secretKey  === 'string' ? body.secretKey.trim()  : ''
    inlineR2Url      = typeof body.r2PublicUrl === 'string' ? body.r2PublicUrl.trim() : ''
  } catch { /* ignore */ }

  // Resolve config: inline > DB > env vars
  let driver     = inlineDriver
  let bucket     = inlineBucket
  let region     = inlineRegion
  let endpoint   = inlineEndpoint
  let accessKey  = inlineAccessKey
  let secretKey  = inlineSecretKey
  let r2PublicUrl = inlineR2Url

  if (!driver) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'storage_config' } })
      if (row) {
        let notes: Record<string, string> = {}
        try { notes = JSON.parse(row.notes) } catch { /* ignore */ }
        if (!driver)    driver    = notes.driver    || ''
        if (!bucket)    bucket    = notes.bucket    || ''
        if (!region)    region    = notes.region    || ''
        if (!endpoint)  endpoint  = notes.endpoint  || ''
        if (!accessKey) accessKey = notes.accessKey || ''
        if (!r2PublicUrl) r2PublicUrl = notes.r2PublicUrl || ''
        if (!secretKey && row.apiKey) {
          secretKey = decryptVaultKey(row.apiKey) ?? ''
        }
      }
    } catch { /* ignore */ }
  }

  if (!driver)    driver    = process.env.STORAGE_DRIVER ?? 'local_vps'
  if (!bucket)    bucket    = process.env.S3_BUCKET ?? ''
  if (!region)    region    = process.env.S3_REGION ?? ''
  if (!endpoint)  endpoint  = process.env.S3_ENDPOINT ?? ''
  if (!accessKey) accessKey = process.env.AWS_ACCESS_KEY_ID ?? ''
  if (!secretKey) secretKey = process.env.AWS_SECRET_ACCESS_KEY ?? ''
  if (!r2PublicUrl) r2PublicUrl = process.env.R2_PUBLIC_URL ?? ''

  // ── VPS Local (persistent) ──
  if (driver === 'local_vps') {
    const VPS_BASE = '/var/www/amarktai/storage'
    const REQUIRED_SUBDIRS = ['artifacts', 'workspaces', 'repos', 'uploads', 'logs']
    const start = Date.now()
    try {
      const { mkdir, writeFile, unlink } = await import('fs/promises')
      // Ensure all required subdirectories exist
      await Promise.all([
        mkdir(VPS_BASE, { recursive: true }),
        ...REQUIRED_SUBDIRS.map(sub => mkdir(`${VPS_BASE}/${sub}`, { recursive: true })),
      ])
      const testFile = `${VPS_BASE}/.write-test-${Date.now()}`
      await writeFile(testFile, 'test')
      await unlink(testFile)
      return NextResponse.json({
        success: true,
        driver: 'local_vps',
        persistent: true,
        basePath: VPS_BASE,
        subdirectories: REQUIRED_SUBDIRS,
        latencyMs: Date.now() - start,
      })
    } catch (err) {
      return NextResponse.json({
        success: false,
        driver: 'local_vps',
        error: `Write access test failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── Local (ephemeral) ──
  if (driver === 'local') {
    const status = getStorageStatus()
    return NextResponse.json({
      success: true,
      driver: 'local',
      persistent: false,
      warning: 'Local file storage is ephemeral — artifacts will be lost on redeploy. Use VPS local storage for persistence.',
      basePath: status.basePath,
    })
  }

  // ── S3 / R2 ── (verify credentials by issuing a real AWS S3 API request)
  if (!bucket) {
    return NextResponse.json({
      success: false,
      driver,
      error: 'No bucket configured',
    })
  }
  if (!accessKey || !secretKey) {
    return NextResponse.json({
      success: false,
      driver,
      error: 'No access credentials configured',
    })
  }

  const start = Date.now()
  try {
    // Use AWS Signature V4 for a HEAD bucket request to verify connectivity
    const effectiveRegion = region || (driver === 'r2' ? 'auto' : 'us-east-1')

    // Validate custom endpoint to prevent SSRF when provided
    if (endpoint) {
      let parsedEndpoint: URL
      try {
        parsedEndpoint = new URL(endpoint)
      } catch {
        return NextResponse.json({ success: false, driver, bucket, error: 'Invalid S3 endpoint URL' })
      }
      if (parsedEndpoint.protocol !== 'https:' && parsedEndpoint.protocol !== 'http:') {
        return NextResponse.json({ success: false, driver, bucket, error: 'S3 endpoint must use http or https' })
      }
      const epHost = parsedEndpoint.hostname.toLowerCase()
      if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(epHost) && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, driver, bucket, error: 'Private or loopback endpoint URLs are not allowed' })
      }
    }

    // Minimal S3 API connectivity test using STS GetCallerIdentity-style HEAD check
    // We construct a signed URL and check that the service responds at all
    const serviceUrl = endpoint
      ? `${endpoint}/${bucket}`
      : `https://${bucket}.s3.${effectiveRegion}.amazonaws.com`

    // This HEAD request will tell us if the bucket exists and the credentials are valid
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const datetime = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

    const { createHmac, createHash } = await import('crypto')

    const method = 'HEAD'
    const canonicalUri = '/'
    const canonicalQueryString = ''
    const canonicalHeaders = `host:${new URL(serviceUrl).host}\nx-amz-date:${datetime}\n`
    const signedHeaders = 'host;x-amz-date'
    const payloadHash = createHash('sha256').update('').digest('hex')
    const canonicalRequest = [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join('\n')

    const scope = `${date}/${effectiveRegion}/s3/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', datetime, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

    function hmac(key: Buffer | string, data: string): Buffer {
      return createHmac('sha256', key).update(data).digest()
    }
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), effectiveRegion), 's3'), 'aws4_request')
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const res = await fetch(serviceUrl, {
      method: 'HEAD',
      headers: {
        'x-amz-date': datetime,
        Authorization: authorization,
      },
      signal: AbortSignal.timeout(10_000),
    })

    const latencyMs = Date.now() - start

    if (res.ok || res.status === 301 || res.status === 403) {
      // 301 = redirect (bucket exists, different region), 403 = auth issue but bucket exists
      return NextResponse.json({
        success: res.ok || res.status === 301,
        driver,
        bucket,
        region: effectiveRegion,
        status: res.status,
        latencyMs,
        warning: res.status === 403 ? 'Bucket found but credentials may lack access — check IAM permissions' : undefined,
      })
    }

    return NextResponse.json({
      success: false,
      driver,
      bucket,
      error: `Storage returned HTTP ${res.status}`,
      latencyMs,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      driver,
      bucket,
      error: err instanceof Error ? err.message : 'Connection failed',
      latencyMs: Date.now() - start,
    })
  }
}
