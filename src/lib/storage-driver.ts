/**
 * @module storage-driver
 * @description Pluggable storage abstraction for the AmarktAI Network.
 *
 * Supports:
 *   - 'local_vps' — VPS persistent storage at /var/www/amarktai/storage (default)
 *   - 'local'     — file system storage relative to project root (dev/ephemeral)
 *   - 's3'        — S3-compatible object storage (AWS S3, MinIO, etc.)
 *   - 'r2'        — Cloudflare R2 (S3-compatible API)
 *
 * The active driver is selected via STORAGE_DRIVER env var (default: 'local_vps').
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

// ── VPS Persistent Storage Driver ────────────────────────────────────────────

const VPS_STORAGE_BASE = '/var/www/amarktai/storage'

class VpsLocalStorageDriver implements StorageDriver {
  name = 'local_vps'

  private resolvePath(key: string): string {
    // Resolve the full path and verify it remains within the base directory.
    // This is the primary protection against path traversal — path.resolve
    // normalises all '..' components before the boundary check.
    const resolved = path.resolve(VPS_STORAGE_BASE, key)
    if (!resolved.startsWith(path.resolve(VPS_STORAGE_BASE) + path.sep) &&
        resolved !== path.resolve(VPS_STORAGE_BASE)) {
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

  /** Ensure all required subdirectories exist. */
  async ensureDirectories(): Promise<void> {
    for (const sub of ['artifacts', 'workspaces', 'logs']) {
      await fs.mkdir(path.join(VPS_STORAGE_BASE, sub), { recursive: true })
    }
  }
}

// ── Local File System Driver ─────────────────────────────────────────────────

const LOCAL_BASE_DIR = process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), '.storage')

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
 * Selected via STORAGE_DRIVER env var (default: 'local_vps').
 */
export function getStorageDriver(): StorageDriver {
  if (_cachedDriver) return _cachedDriver

  const driverName = (process.env.STORAGE_DRIVER ?? 'local_vps').toLowerCase()

  switch (driverName) {
    case 'local_vps':
      _cachedDriver = new VpsLocalStorageDriver()
      break
    case 's3':
      _cachedDriver = new S3StorageDriver()
      break
    case 'r2':
      _cachedDriver = new R2StorageDriver()
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
} {
  const driverName = (process.env.STORAGE_DRIVER ?? 'local_vps').toLowerCase()

  if (driverName === 'local_vps') {
    return {
      driver: 'local_vps',
      configured: true,
      basePath: VPS_STORAGE_BASE,
      note: `VPS local storage active at ${VPS_STORAGE_BASE}. Persists across redeployments.`,
    }
  }

  if (driverName === 's3') {
    const configured = !!(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID)
    return {
      driver: 's3',
      configured,
      basePath: process.env.S3_BUCKET ?? '',
      note: configured ? 'S3 storage configured' : 'S3 credentials not set — falling back to local',
    }
  }

  if (driverName === 'r2') {
    const configured = !!(process.env.R2_PUBLIC_URL)
    return {
      driver: 'r2',
      configured,
      basePath: process.env.R2_PUBLIC_URL ?? '',
      note: configured ? 'Cloudflare R2 configured' : 'R2 not configured — falling back to local',
    }
  }

  return {
    driver: 'local',
    configured: true,
    basePath: LOCAL_BASE_DIR,
    note: 'Local file storage active (ephemeral). Set STORAGE_DRIVER=local_vps for persistent VPS storage.',
  }
}
