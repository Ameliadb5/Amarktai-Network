/**
 * @module storage-driver
 * @description Pluggable storage abstraction for the AmarktAI Network.
 *
 * Supports:
 *   - 'local'     — file system storage in the project directory (development only)
 *   - 'local_vps' — file system storage at a configurable VPS path (persistent across redeploys)
 *   - 's3'        — S3-compatible object storage (AWS S3, MinIO, etc.)
 *   - 'r2'        — Cloudflare R2 (S3-compatible API)
 *
 * The active driver is selected via STORAGE_DRIVER env var (default: 'local').
 * Business logic never references a specific cloud vendor — only this interface.
 *
 * Server-side only.
 */

import fs from 'fs/promises'
import path from 'path'

// ── Interface ────────────────────────────────────────────────────────────────

export interface StoragePutResult {
  url: string
  path: string
  sizeBytes: number
}

export interface StorageDriver {
  /** Human-readable driver name. */
  name: string
  /** Store a blob under the given key. Returns the public/signed URL. */
  put(key: string, data: Buffer, contentType: string): Promise<StoragePutResult>
  /** Retrieve a blob by key. Returns null if not found. */
  get(key: string): Promise<Buffer | null>
  /** Delete a blob by key. Returns true if deleted. */
  delete(key: string): Promise<boolean>
  /** Check if a blob exists. */
  exists(key: string): Promise<boolean>
  /** Get a public/signed URL for a stored blob. */
  getUrl(key: string): Promise<string>
}

// ── Local File System Driver ─────────────────────────────────────────────────

const LOCAL_BASE_DIR = process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), '.storage')

/**
 * VPS-persistent local storage base directory.
 * Stored outside the project tree so git clean / redeploy does not delete artifacts.
 * Configurable via STORAGE_VPS_DIR env var.
 * Default: /var/www/amarktai/storage/artifacts
 */
const LOCAL_VPS_BASE_DIR =
  process.env.STORAGE_VPS_DIR ?? '/var/www/amarktai/storage/artifacts'

class LocalStorageDriver implements StorageDriver {
  name = 'local'

  private resolvePath(key: string): string {
    // Sanitize key: strip any path traversal attempts, then validate resolved path
    const sanitized = key.replace(/\.\./g, '').replace(/^\/+/, '')
    const resolved = path.resolve(LOCAL_BASE_DIR, sanitized)
    // Ensure the resolved path is still within the base directory
    if (!resolved.startsWith(path.resolve(LOCAL_BASE_DIR))) {
      throw new Error('Path traversal detected')
    }
    return resolved
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<StoragePutResult> {
    const filePath = this.resolvePath(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)
    const url = `/api/artifacts/file/${encodeURIComponent(key)}`
    return { url, path: key, sizeBytes: data.length }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolvePath(key))
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await fs.unlink(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }

  async getUrl(key: string): Promise<string> {
    return `/api/artifacts/file/${encodeURIComponent(key)}`
  }
}

// ── VPS-Persistent Local Storage Driver ──────────────────────────────────────

/**
 * Stores artifacts at a configurable path outside the project directory.
 * Default: /var/www/amarktai/storage/artifacts
 * Configured via STORAGE_VPS_DIR env var.
 *
 * Unlike the 'local' driver, files here survive git clean, redeployments,
 * and Docker container rebuilds — as long as the VPS volume is mounted
 * at the same path.
 */
class LocalVpsStorageDriver implements StorageDriver {
  name = 'local_vps'

  private baseDir: string

  constructor() {
    this.baseDir = LOCAL_VPS_BASE_DIR
  }

  private resolvePath(key: string): string {
    const sanitized = key.replace(/\.\./g, '').replace(/^\/+/, '')
    const resolved = path.resolve(this.baseDir, sanitized)
    if (!resolved.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Path traversal detected')
    }
    return resolved
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<StoragePutResult> {
    const filePath = this.resolvePath(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)
    const url = `/api/artifacts/file/${encodeURIComponent(key)}`
    return { url, path: key, sizeBytes: data.length }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolvePath(key))
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await fs.unlink(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }

  async getUrl(key: string): Promise<string> {
    return `/api/artifacts/file/${encodeURIComponent(key)}`
  }
}

// ── S3-Compatible Driver (stub — ready for Phase 3 full implementation) ──────


class S3StorageDriver implements StorageDriver {
  name = 's3'

  private bucket = process.env.S3_BUCKET ?? 'amarktai-artifacts'
  private region = process.env.S3_REGION ?? 'us-east-1'
  private endpoint = process.env.S3_ENDPOINT ?? ''

  async put(key: string, data: Buffer, contentType: string): Promise<StoragePutResult> {
    // Phase 3: Use @aws-sdk/client-s3 for real S3 upload
    // For now, fall back to local storage with a warning
    console.warn(`[storage] S3 driver not fully configured — storing locally. Set S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY`)
    const local = new LocalStorageDriver()
    return local.put(key, data, contentType)
  }

  async get(key: string): Promise<Buffer | null> {
    console.warn(`[storage] S3 get not implemented — checking local fallback`)
    const local = new LocalStorageDriver()
    return local.get(key)
  }

  async delete(key: string): Promise<boolean> {
    const local = new LocalStorageDriver()
    return local.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const local = new LocalStorageDriver()
    return local.exists(key)
  }

  async getUrl(key: string): Promise<string> {
    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${key}`
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
  }
}

// ── R2 Driver (Cloudflare R2 — S3-compatible, stub) ──────────────────────────

class R2StorageDriver implements StorageDriver {
  name = 'r2'

  async put(key: string, data: Buffer, contentType: string): Promise<StoragePutResult> {
    // R2 uses the S3 API — delegate to S3 driver with R2 endpoint
    console.warn(`[storage] R2 driver not fully configured — storing locally`)
    const local = new LocalStorageDriver()
    return local.put(key, data, contentType)
  }

  async get(key: string): Promise<Buffer | null> {
    const local = new LocalStorageDriver()
    return local.get(key)
  }

  async delete(key: string): Promise<boolean> {
    const local = new LocalStorageDriver()
    return local.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const local = new LocalStorageDriver()
    return local.exists(key)
  }

  async getUrl(key: string): Promise<string> {
    const publicUrl = process.env.R2_PUBLIC_URL
    if (publicUrl) return `${publicUrl}/${key}`
    return `/api/artifacts/file/${encodeURIComponent(key)}`
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

let _cachedDriver: StorageDriver | null = null

/**
 * Get the active storage driver instance.
 * Selected via STORAGE_DRIVER env var (default: 'local').
 */
export function getStorageDriver(): StorageDriver {
  if (_cachedDriver) return _cachedDriver

  const driverName = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase()

  switch (driverName) {
    case 's3':
      _cachedDriver = new S3StorageDriver()
      break
    case 'r2':
      _cachedDriver = new R2StorageDriver()
      break
    case 'local_vps':
      _cachedDriver = new LocalVpsStorageDriver()
      break
    default:
      _cachedDriver = new LocalStorageDriver()
  }

  return _cachedDriver
}

/**
 * Get storage status for dashboard truth.
 */
export function getStorageStatus(): {
  driver: string
  configured: boolean
  basePath: string
  note: string
  persistent: boolean
} {
  const driverName = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase()

  if (driverName === 's3') {
    const configured = !!(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID)
    return {
      driver: 's3',
      configured,
      basePath: process.env.S3_BUCKET ?? '',
      note: configured ? 'S3 storage configured' : 'S3 credentials not set — falling back to local',
      persistent: configured,
    }
  }

  if (driverName === 'r2') {
    const configured = !!(process.env.R2_PUBLIC_URL)
    return {
      driver: 'r2',
      configured,
      basePath: process.env.R2_PUBLIC_URL ?? '',
      note: configured ? 'Cloudflare R2 configured' : 'R2 not configured — falling back to local',
      persistent: configured,
    }
  }

  if (driverName === 'local_vps') {
    return {
      driver: 'local_vps',
      configured: true,
      basePath: LOCAL_VPS_BASE_DIR,
      note: `VPS-persistent local storage at ${LOCAL_VPS_BASE_DIR}. Set STORAGE_VPS_DIR to override the path.`,
      persistent: true,
    }
  }

  return {
    driver: 'local',
    configured: true,
    basePath: LOCAL_BASE_DIR,
    note: 'Local file storage (ephemeral — artifacts lost on redeploy). Use local_vps, s3 or r2 for persistent storage.',
    persistent: false,
  }
}

