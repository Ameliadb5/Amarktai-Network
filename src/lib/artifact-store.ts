/**
 * @module artifact-store
 * @description Unified Artifact System for the AmarktAI Network platform.
 *
 * Every generated output (image, audio, music, video, code, document) is
 * persisted as an Artifact with full metadata, storage references, and
 * download/preview capabilities.
 *
 * Phase 2: DB-backed artifact metadata with pluggable storage driver.
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'
import { getStorageDriver, type StorageDriver } from '@/lib/storage-driver'
import { emitSystemEvent } from '@/lib/event-bus'

// ── Types ────────────────────────────────────────────────────────────────────

export type ArtifactType =
  | 'image'
  | 'audio'
  | 'music'
  | 'video'
  | 'code'
  | 'document'
  | 'report'
  | 'transcript'
  | 'diff'        // Phase 3C: AI-generated code diff / changeset
  | 'changeset'   // Phase 3C: approved and applied changeset with file patches
  | 'deploy_log'  // Phase 3E: direct VPS deploy log

export type ArtifactStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired'

export interface CreateArtifactInput {
  appSlug: string
  type: ArtifactType
  subType?: string
  title?: string
  description?: string
  provider?: string
  model?: string
  traceId?: string
  mimeType?: string
  costUsdCents?: number
  metadata?: Record<string, unknown>
  /** Raw content (Buffer, base64 string, or URL) — stored via storage driver */
  content?: Buffer | string
  /** If content is a URL, store the URL directly without uploading */
  contentUrl?: string
  status?: ArtifactStatus
  errorMessage?: string
}

export interface ArtifactRecord {
  id: string
  appSlug: string
  type: string
  subType: string
  title: string
  description: string
  provider: string
  model: string
  traceId: string
  storageDriver: string
  storagePath: string
  storageUrl: string
  mimeType: string
  fileSizeBytes: number
  previewable: boolean
  downloadable: boolean
  status: string
  errorMessage: string
  costUsdCents: number
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface ArtifactListOptions {
  appSlug?: string
  type?: ArtifactType
  status?: ArtifactStatus
  limit?: number
  offset?: number
}

// ── MIME type inference ──────────────────────────────────────────────────────

const TYPE_MIME_MAP: Record<string, string> = {
  image: 'image/png',
  audio: 'audio/mpeg',
  music: 'audio/mpeg',
  video: 'video/mp4',
  code: 'text/plain',
  document: 'application/pdf',
  report: 'application/pdf',
  transcript: 'text/plain',
}

function inferMimeType(type: ArtifactType, subType?: string): string {
  if (subType === 'tts') return 'audio/mpeg'
  if (subType === 'stt') return 'text/plain'
  if (subType === 'cover_art') return 'image/png'
  return TYPE_MIME_MAP[type] ?? 'application/octet-stream'
}

function isPreviewable(type: ArtifactType): boolean {
  return ['image', 'audio', 'music', 'video'].includes(type)
}

// ── Core Operations ──────────────────────────────────────────────────────────

/**
 * Create a new artifact with optional content upload.
 */
export async function createArtifact(input: CreateArtifactInput): Promise<ArtifactRecord> {
  const driver: StorageDriver = getStorageDriver()
  const mimeType = input.mimeType ?? inferMimeType(input.type, input.subType)

  let storagePath = ''
  let storageUrl = input.contentUrl ?? ''
  let fileSizeBytes = 0

  // Upload content if provided
  if (input.content) {
    const buf = typeof input.content === 'string'
      ? Buffer.from(input.content, 'base64')
      : input.content
    fileSizeBytes = buf.length
    const ext = mimeType.split('/')[1] ?? 'bin'
    const key = `artifacts/${input.appSlug}/${input.type}/${Date.now()}.${ext}`
    const result = await driver.put(key, buf, mimeType)
    storagePath = key
    storageUrl = result.url
  }

  const row = await prisma.artifact.create({
    data: {
      appSlug: input.appSlug,
      type: input.type,
      subType: input.subType ?? '',
      title: input.title ?? '',
      description: input.description ?? '',
      provider: input.provider ?? '',
      model: input.model ?? '',
      traceId: input.traceId ?? '',
      storageDriver: driver.name,
      storagePath,
      storageUrl,
      mimeType,
      fileSizeBytes,
      previewable: isPreviewable(input.type),
      downloadable: true,
      status: input.status ?? 'completed',
      errorMessage: input.errorMessage ?? '',
      costUsdCents: input.costUsdCents ?? 0,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  })

  const artifact = toArtifactRecord(row)

  // Emit SSE event so the dashboard live feed shows new artifacts in real time
  emitSystemEvent('artifact_created', {
    id: artifact.id,
    type: artifact.type,
    appSlug: artifact.appSlug,
    title: artifact.title,
    provider: artifact.provider,
    model: artifact.model,
    traceId: artifact.traceId,
    storageUrl: artifact.storageUrl,
    timestamp: new Date().toISOString(),
  }, artifact.appSlug)

  return artifact
}

/**
 * Get a single artifact by ID.
 */
export async function getArtifact(id: string): Promise<ArtifactRecord | null> {
  const row = await prisma.artifact.findUnique({ where: { id } })
  return row ? toArtifactRecord(row) : null
}

/**
 * List artifacts with optional filters.
 */
export async function listArtifacts(opts: ArtifactListOptions = {}): Promise<{
  artifacts: ArtifactRecord[]
  total: number
}> {
  const where: Record<string, unknown> = {}
  if (opts.appSlug) where.appSlug = opts.appSlug
  if (opts.type) where.type = opts.type
  if (opts.status) where.status = opts.status

  const [rows, total] = await Promise.all([
    prisma.artifact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? 50, 200),
      skip: opts.offset ?? 0,
    }),
    prisma.artifact.count({ where }),
  ])

  return { artifacts: rows.map(toArtifactRecord), total }
}

/**
 * Get artifact counts grouped by type for a given app (or globally).
 */
export async function getArtifactCounts(appSlug?: string): Promise<Record<string, number>> {
  const where = appSlug ? { appSlug } : {}
  const groups = await prisma.artifact.groupBy({
    by: ['type'],
    where,
    _count: { id: true },
  })
  const result: Record<string, number> = {}
  for (const g of groups) {
    result[g.type] = g._count.id
  }
  return result
}

/**
 * Update artifact status (e.g. when video processing completes).
 */
export async function updateArtifactStatus(
  id: string,
  status: ArtifactStatus,
  extra?: { storageUrl?: string; errorMessage?: string; metadata?: Record<string, unknown> },
): Promise<ArtifactRecord | null> {
  try {
    const data: Record<string, unknown> = { status }
    if (extra?.storageUrl) data.storageUrl = extra.storageUrl
    if (extra?.errorMessage) data.errorMessage = extra.errorMessage
    if (extra?.metadata) data.metadata = JSON.stringify(extra.metadata)
    const row = await prisma.artifact.update({ where: { id }, data })
    return toArtifactRecord(row)
  } catch {
    return null
  }
}

/**
 * Delete an artifact (metadata + storage content).
 */
export async function deleteArtifact(id: string): Promise<boolean> {
  try {
    const row = await prisma.artifact.findUnique({ where: { id } })
    if (!row) return false

    // Delete from storage if path exists
    if (row.storagePath) {
      const driver = getStorageDriver()
      await driver.delete(row.storagePath)
    }

    await prisma.artifact.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

// ── Row mapping ──────────────────────────────────────────────────────────────

function toArtifactRecord(row: {
  id: string; appSlug: string; type: string; subType: string; title: string;
  description: string; provider: string; model: string; traceId: string;
  storageDriver: string; storagePath: string; storageUrl: string;
  mimeType: string; fileSizeBytes: number; previewable: boolean;
  downloadable: boolean; status: string; errorMessage: string;
  costUsdCents: number; metadata: string; createdAt: Date; updatedAt: Date;
}): ArtifactRecord {
  let metadata: Record<string, unknown> = {}
  try { metadata = JSON.parse(row.metadata) } catch { /* ignore */ }
  return {
    ...row,
    metadata,
  }
}
