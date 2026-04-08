/**
 * crypto-vault.ts — AES-256-GCM at-rest encryption for provider API keys.
 *
 * All API keys stored in the `ai_providers` table are encrypted with this
 * module before being written and decrypted after being read.
 *
 * Configuration:
 *   VAULT_ENCRYPTION_KEY — 64-char hex string (32 raw bytes).
 *   Generate with:  openssl rand -hex 32
 *
 * If VAULT_ENCRYPTION_KEY is not set the module falls back to storing values
 * in plaintext and emits a server-side warning. This lets existing deployments
 * continue working while operators add the key.
 *
 * Cipher: AES-256-GCM
 *   - 12-byte random IV per encryption (prepended to ciphertext)
 *   - 16-byte auth tag (appended after ciphertext)
 *   - Resulting wire format: base64( iv[12] + ciphertext + tag[16] )
 *   - Prefix "v1:" distinguishes encrypted values from plaintext legacy values.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm' as const
const IV_LEN = 12 // bytes (GCM recommended)
const TAG_LEN = 16 // bytes
const PREFIX = 'v1:' // version tag prepended to base64 blob

let _key: Buffer | null = null

/** Resolve and cache the 32-byte AES key from VAULT_ENCRYPTION_KEY env var. */
function getKey(): Buffer | null {
  if (_key) return _key
  const hex = process.env.VAULT_ENCRYPTION_KEY?.trim()
  if (!hex) return null
  if (hex.length !== 64) {
    console.warn(
      '[crypto-vault] VAULT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Falling back to plaintext storage.',
    )
    return null
  }
  try {
    _key = Buffer.from(hex, 'hex')
    return _key
  } catch {
    console.warn('[crypto-vault] VAULT_ENCRYPTION_KEY is not valid hex. Falling back to plaintext storage.')
    return null
  }
}

/**
 * Encrypt a plaintext API key for storage.
 *
 * - If VAULT_ENCRYPTION_KEY is set: returns "v1:<base64(iv+ciphertext+tag)>"
 * - If not set: returns plaintext unchanged (with a one-time server warning).
 */
export function encryptVaultKey(plain: string): string {
  if (!plain) return plain
  const key = getKey()
  if (!key) {
    if (!_warnedNoKey) {
      console.warn(
        '[crypto-vault] VAULT_ENCRYPTION_KEY is not configured. ' +
        'API keys will be stored unencrypted. ' +
        'Set VAULT_ENCRYPTION_KEY to a 64-hex-char secret to enable at-rest encryption.',
      )
      _warnedNoKey = true
    }
    return plain
  }

  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const blob = Buffer.concat([iv, ct, tag])
  return PREFIX + blob.toString('base64')
}

/**
 * Decrypt a stored API key.
 *
 * - If the value starts with "v1:" it is decrypted.
 * - Otherwise it is returned as-is (handles legacy plaintext rows).
 * - Returns null if decryption fails (key rotated, corrupted data, etc.).
 */
export function decryptVaultKey(stored: string): string | null {
  if (!stored) return stored || null
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext or empty — return as-is
    return stored
  }

  const key = getKey()
  if (!key) {
    console.error(
      '[crypto-vault] Encrypted key found in DB but VAULT_ENCRYPTION_KEY is not set. ' +
      'Cannot decrypt. Please set VAULT_ENCRYPTION_KEY.',
    )
    return null
  }

  try {
    const blob = Buffer.from(stored.slice(PREFIX.length), 'base64')
    if (blob.length < IV_LEN + TAG_LEN + MIN_CIPHERTEXT_LEN) return null
    const iv = blob.subarray(0, IV_LEN)
    const tag = blob.subarray(blob.length - TAG_LEN)
    const ct = blob.subarray(IV_LEN, blob.length - TAG_LEN)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    console.error('[crypto-vault] Failed to decrypt vault key — key may have been rotated or data is corrupt.')
    return null
  }
}

let _warnedNoKey = false
const MIN_CIPHERTEXT_LEN = 1 // at least 1 byte of ciphertext required
