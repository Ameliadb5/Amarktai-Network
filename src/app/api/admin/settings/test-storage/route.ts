/**
 * POST /api/admin/settings/test-storage
 * Tests storage configuration and reports driver type and persistence.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Resolve effective driver and config: DB row takes priority over env vars
    let driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase() as 'local' | 's3' | 'r2'
    let bucket = process.env.S3_BUCKET ?? ''
    let accessKey = process.env.AWS_ACCESS_KEY_ID ?? ''
    let publicUrl = process.env.R2_PUBLIC_URL ?? ''

    const row = await prisma.integrationConfig.findUnique({ where: { key: 'storage_config' } })
    if (row) {
      if (row.apiUrl) driver = row.apiUrl as 'local' | 's3' | 'r2'
      if (row.notes) {
        try {
          const parsed = JSON.parse(row.notes)
          if (parsed.bucket) bucket = parsed.bucket
          if (parsed.publicUrl) publicUrl = parsed.publicUrl
        } catch { /* ignore */ }
      }
      // Note: keys are encrypted, we just check presence for config validation
      if (row.apiKey) accessKey = 'configured'
    }

    if (driver === 'local') {
      return NextResponse.json({
        success: true,
        driver: 'local',
        persistent: false,
        error: null,
        note: 'Local file storage is active. Files are stored on the container filesystem and will not persist across restarts.',
      })
    }

    if (driver === 's3') {
      const configured = !!(bucket && accessKey)
      if (!configured) {
        return NextResponse.json({
          success: false,
          driver: 's3',
          persistent: true,
          error: 'S3 not fully configured — bucket and access key are required',
        })
      }
      return NextResponse.json({
        success: true,
        driver: 's3',
        persistent: true,
        error: null,
        note: `S3 storage configured with bucket: ${bucket}`,
      })
    }

    if (driver === 'r2') {
      const configured = !!(publicUrl && accessKey)
      if (!configured) {
        return NextResponse.json({
          success: false,
          driver: 'r2',
          persistent: true,
          error: 'R2 not fully configured — public URL and access key are required',
        })
      }
      return NextResponse.json({
        success: true,
        driver: 'r2',
        persistent: true,
        error: null,
        note: `Cloudflare R2 configured with public URL: ${publicUrl}`,
      })
    }

    return NextResponse.json({
      success: false,
      driver,
      persistent: false,
      error: `Unknown storage driver: ${driver}`,
    })
  } catch (e) {
    return NextResponse.json({
      success: false,
      driver: 'unknown',
      persistent: false,
      error: e instanceof Error ? e.message : 'Test failed',
    })
  }
}
