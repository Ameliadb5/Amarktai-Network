/**
 * Config Validator Tests
 *
 * Validates the config validation module detects placeholder DB URLs,
 * invalid session secrets, and classifies DB errors correctly.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  isDatabaseUrlPlaceholder,
  isSessionSecretInvalid,
  validateConfig,
  classifyDbError,
  configErrorResponse,
  type ConfigValidationResult,
} from '@/lib/config-validator'

describe('isDatabaseUrlPlaceholder', () => {
  it('returns true for empty string', () => {
    expect(isDatabaseUrlPlaceholder('')).toBe(true)
  })

  it('returns true for the .env.example default URL', () => {
    expect(isDatabaseUrlPlaceholder('postgresql://user:password@host:5432/amarktai_network')).toBe(true)
  })

  it('returns true when host is "localhost"', () => {
    expect(isDatabaseUrlPlaceholder('postgresql://myuser:mypass@localhost:5432/mydb')).toBe(true)
  })

  it('returns true when host is "127.0.0.1"', () => {
    expect(isDatabaseUrlPlaceholder('postgresql://myuser:mypass@127.0.0.1:5432/mydb')).toBe(true)
  })

  it('returns true when user is "user" and password is "password"', () => {
    expect(isDatabaseUrlPlaceholder('postgresql://user:password@real-db-host.com:5432/mydb')).toBe(true)
  })

  it('returns false for a real production-style URL', () => {
    expect(
      isDatabaseUrlPlaceholder(
        'postgresql://appuser:Str0ngP@ssw0rd!@prod-db.us-east-1.rds.amazonaws.com:5432/amarktai',
      ),
    ).toBe(false)
  })

  it('returns false for a Neon-style URL', () => {
    expect(
      isDatabaseUrlPlaceholder(
        'postgresql://jane:securePass@ep-cool-dream-123456.us-east-2.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe(false)
  })

  it('returns true for unparsable URL', () => {
    expect(isDatabaseUrlPlaceholder('not-a-url')).toBe(true)
  })
})

describe('isSessionSecretInvalid', () => {
  it('returns true for undefined', () => {
    expect(isSessionSecretInvalid(undefined)).toBe(true)
  })

  it('returns true for empty string', () => {
    expect(isSessionSecretInvalid('')).toBe(true)
  })

  it('returns true for string shorter than 32 chars', () => {
    expect(isSessionSecretInvalid('tooshort')).toBe(true)
  })

  it('returns true for the .env.example default secret', () => {
    expect(isSessionSecretInvalid('your-super-secret-session-key-min-32-chars')).toBe(true)
  })

  it('returns false for a valid 32+ char secret', () => {
    expect(isSessionSecretInvalid('this-is-a-valid-session-secret-key-long-enough!')).toBe(false)
  })
})

describe('validateConfig', () => {
  const origDb  = process.env.DATABASE_URL
  const origSec = process.env.SESSION_SECRET

  afterEach(() => {
    if (origDb !== undefined) {
      process.env.DATABASE_URL = origDb
    } else {
      delete process.env.DATABASE_URL
    }
    if (origSec !== undefined) {
      process.env.SESSION_SECRET = origSec
    } else {
      delete process.env.SESSION_SECRET
    }
  })

  it('reports error when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL
    delete process.env.SESSION_SECRET
    const result = validateConfig()
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.key === 'DATABASE_URL' && i.severity === 'error')).toBe(true)
  })

  it('reports error when DATABASE_URL is a placeholder', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@host:5432/mydb'
    process.env.SESSION_SECRET = 'valid-long-enough-secret-key-here-yes-sir!'
    const result = validateConfig()
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.key === 'DATABASE_URL' && i.severity === 'error')).toBe(true)
  })

  it('reports error when SESSION_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://admin:realpass@real-host.example.com:5432/db'
    delete process.env.SESSION_SECRET
    const result = validateConfig()
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.key === 'SESSION_SECRET' && i.severity === 'error')).toBe(true)
  })

  it('returns valid when both DATABASE_URL and SESSION_SECRET look real', () => {
    process.env.DATABASE_URL =
      'postgresql://appuser:Str0ngP@ssw0rd!@prod.db.example.com:5432/amarktai'
    process.env.SESSION_SECRET = 'totally-valid-session-secret-of-fifty-chars-long!!'
    const result = validateConfig()
    expect(result.valid).toBe(true)
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
  })
})

describe('classifyDbError', () => {
  it('classifies missing DATABASE_URL env var', () => {
    const err = new Error('Environment variable not found: DATABASE_URL')
    const { category } = classifyDbError(err)
    expect(category).toBe('config_invalid')
  })

  it('classifies connection refused error', () => {
    const err = new Error('Connection refused (ECONNREFUSED)')
    const { category } = classifyDbError(err)
    expect(category).toBe('db_connection')
  })

  it('classifies password authentication failure', () => {
    const err = new Error('password authentication failed for user "app"')
    const { category } = classifyDbError(err)
    expect(category).toBe('db_auth')
  })

  it('classifies missing table (schema drift)', () => {
    const err = new Error('relation "ai_providers" does not exist')
    const { category } = classifyDbError(err)
    expect(category).toBe('db_schema')
  })

  it('classifies unique constraint violation', () => {
    const err = new Error('Unique constraint failed on field email')
    const { category } = classifyDbError(err)
    expect(category).toBe('db_constraint')
  })

  it('returns unknown for non-Error values', () => {
    const { category } = classifyDbError('some random string')
    expect(category).toBe('unknown')
  })
})

describe('configErrorResponse', () => {
  it('includes error string and category', () => {
    const result: ConfigValidationResult = {
      valid: false,
      dbReachable: null,
      dbError: null,
      issues: [
        { key: 'DATABASE_URL', severity: 'error', message: 'URL is a placeholder' },
      ],
    }
    const resp = configErrorResponse(result)
    expect(resp.category).toBe('config_invalid')
    expect(resp.error).toContain('DATABASE_URL')
    expect(resp.issues).toHaveLength(1)
  })

  it('produces a non-empty error message when issues exist', () => {
    const result: ConfigValidationResult = {
      valid: false,
      dbReachable: false,
      dbError: 'Cannot connect',
      issues: [
        { key: 'DATABASE_URL', severity: 'error', message: 'Placeholder detected' },
        { key: 'SESSION_SECRET', severity: 'error', message: 'Secret too short' },
      ],
    }
    const resp = configErrorResponse(result)
    expect(resp.error.length).toBeGreaterThan(0)
    expect(resp.issues).toHaveLength(2)
  })
})
