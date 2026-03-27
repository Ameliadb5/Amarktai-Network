/**
 * @module config-validator
 * @description Repo-level configuration validation for AmarktAI Network.
 *
 * Detects placeholder / fake config values and reports them clearly so that
 * routes and the readiness audit can surface real errors instead of generic 500s.
 *
 * Server-side only — do NOT import from client components.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type ConfigSeverity = 'error' | 'warning' | 'ok';

export interface ConfigIssue {
  key: string;
  severity: ConfigSeverity;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;               // false if any error-severity issue exists
  dbReachable: boolean | null;  // null = not yet tested
  issues: ConfigIssue[];
  dbError: string | null;       // human-readable DB connectivity error if any
}

// ── Placeholder detection ───────────────────────────────────────────────────

/**
 * Known placeholder host fragments that indicate a default/example DATABASE_URL.
 * These values MUST NOT be treated as a real database.
 *
 * Note: 'localhost' and '127.0.0.1' are NOT included here because they are
 * legitimate database hosts for self-hosted / VPS deployments.
 */
const PLACEHOLDER_DB_HOSTS = [
  'host',
  'your-db-host',
  'your-hostname',
  'placeholder',
  'example.com',
];

/**
 * Placeholder usernames that indicate a default/example DATABASE_URL.
 *
 * Note: 'postgres' is NOT included here because it is the standard
 * superuser name in PostgreSQL and is commonly used in real deployments.
 * The user+password combo check below still catches 'postgres'+'password'.
 */
const PLACEHOLDER_DB_USERS = [
  'user',
  'username',
  'your-user',
  'root',
  'admin',
];

/** Placeholder passwords that indicate a default/example DATABASE_URL. */
const PLACEHOLDER_DB_PASSWORDS = [
  'password',
  'your-password',
  'secret',
  'changeme',
  '1234',
  '12345',
  'test',
  '',
];

/**
 * Returns true if the DATABASE_URL value looks like a placeholder/example.
 *
 * Rules (in order):
 * 1. Empty or unparseable URL → placeholder
 * 2. Host matches a known placeholder list → placeholder
 *    (localhost and 127.0.0.1 are NOT on this list — they are valid for VPS deployments)
 * 3. BOTH user AND password match known placeholder lists → placeholder
 *
 * A real local PostgreSQL URL like:
 *   postgresql://amarktai_user:RealPass@localhost:5432/amarktai_network
 * is accepted as valid.
 */
export function isDatabaseUrlPlaceholder(url: string): boolean {
  if (!url || url.trim() === '') return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Unparsable URL is always invalid
    return true;
  }

  const host     = parsed.hostname.toLowerCase();
  const user     = parsed.username.toLowerCase();
  const password = parsed.password.toLowerCase();

  // Host-only match is enough
  if (PLACEHOLDER_DB_HOSTS.includes(host)) return true;

  // Both user AND password match placeholders
  if (
    PLACEHOLDER_DB_USERS.includes(user) &&
    PLACEHOLDER_DB_PASSWORDS.includes(password)
  ) return true;

  return false;
}

/**
 * Returns true if SESSION_SECRET is absent or too short / obviously fake.
 */
export function isSessionSecretInvalid(secret: string | undefined): boolean {
  if (!secret) return true;
  const trimmed = secret.trim();
  if (trimmed.length < 32) return true;
  if (
    trimmed === 'your-super-secret-session-key-min-32-chars' ||
    trimmed === 'secret' ||
    trimmed === 'changeme'
  ) return true;
  return false;
}

// ── Main validator ──────────────────────────────────────────────────────────

/**
 * Validate the current runtime config and return a detailed result.
 *
 * Does NOT throw — callers decide what to do with the result.
 */
export function validateConfig(): ConfigValidationResult {
  const issues: ConfigIssue[] = [];

  // ── DATABASE_URL ──────────────────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    issues.push({
      key: 'DATABASE_URL',
      severity: 'error',
      message: 'DATABASE_URL is not set. All DB-backed routes will fail.',
    });
  } else if (isDatabaseUrlPlaceholder(dbUrl)) {
    issues.push({
      key: 'DATABASE_URL',
      severity: 'error',
      message:
        'DATABASE_URL appears to be a placeholder value. ' +
        'Set a real PostgreSQL connection string before enabling DB-backed features.',
    });
  }

  // ── SESSION_SECRET ────────────────────────────────────────────────────────
  const sessionSecret = process.env.SESSION_SECRET ?? process.env.SECRET_COOKIE_PASSWORD;

  if (isSessionSecretInvalid(sessionSecret)) {
    issues.push({
      key: 'SESSION_SECRET',
      severity: 'error',
      message:
        'SESSION_SECRET is missing, too short (< 32 chars), or is a known placeholder. ' +
        'Admin login sessions will be insecure or non-functional.',
    });
  }

  // ── NEXT_PUBLIC_APP_URL ───────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    issues.push({
      key: 'NEXT_PUBLIC_APP_URL',
      severity: 'warning',
      message: 'NEXT_PUBLIC_APP_URL is not set. OAuth callbacks and public links may be incorrect.',
    });
  }

  const valid = !issues.some((i) => i.severity === 'error');

  return {
    valid,
    dbReachable: null, // not tested synchronously; use testDbConnectivity() for that
    issues,
    dbError: null,
  };
}

/**
 * Attempt a lightweight Prisma DB ping to confirm the database is reachable.
 * Returns an augmented ConfigValidationResult with `dbReachable` set.
 *
 * This is async because it performs a real DB query.
 */
export async function validateConfigWithDb(): Promise<ConfigValidationResult> {
  const base = validateConfig();

  // If config is already invalid (e.g. placeholder URL), skip the DB ping
  if (!base.valid) {
    return { ...base, dbReachable: false, dbError: 'Skipped — config has errors' };
  }

  try {
    // Dynamic import to avoid circular dependency with prisma.ts at module load time
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    return { ...base, dbReachable: true, dbError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitise: remove connection string details from error messages
    const safe = msg.replace(/postgresql:\/\/[^\s]+/gi, '[redacted]');
    return {
      ...base,
      valid: false,
      dbReachable: false,
      dbError: safe,
      issues: [
        ...base.issues,
        {
          key: 'DATABASE_URL',
          severity: 'error',
          message: `Database connectivity check failed: ${safe}`,
        },
      ],
    };
  }
}

// ── Route helper ────────────────────────────────────────────────────────────

/**
 * Build a structured JSON error body for route handlers when DB config is bad.
 *
 * Usage:
 *   const check = validateConfig()
 *   if (!check.valid) return configErrorResponse(check)
 */
export function configErrorResponse(result: ConfigValidationResult): {
  error: string;
  category: 'config_invalid';
  issues: ConfigIssue[];
} {
  const messages = result.issues
    .filter((i) => i.severity === 'error')
    .map((i) => `[${i.key}] ${i.message}`);

  return {
    error: messages.join(' | ') || 'Server configuration is invalid.',
    category: 'config_invalid',
    issues: result.issues,
  };
}

/**
 * Classify a caught Prisma / DB error into a human-readable category string.
 *
 * Returns one of:
 *   'db_connection'   — Can't reach the database server
 *   'db_auth'         — Wrong username / password
 *   'db_not_found'    — Database does not exist
 *   'db_schema'       — Table / column missing (schema drift)
 *   'db_constraint'   — Unique/FK constraint violation
 *   'config_invalid'  — DATABASE_URL is missing or placeholder
 *   'unknown'         — Anything else
 */
export function classifyDbError(err: unknown): {
  category: string;
  message: string;
} {
  if (!(err instanceof Error)) {
    return { category: 'unknown', message: String(err) };
  }

  const msg = err.message.toLowerCase();

  if (msg.includes('environment variable not found: database_url') || msg.includes('no database_url')) {
    return { category: 'config_invalid', message: 'DATABASE_URL environment variable is not set.' };
  }
  if (
    msg.includes('econnrefused') ||
    msg.includes('connection refused') ||
    msg.includes('could not connect') ||
    msg.includes('network socket disconnected') ||
    msg.includes('connection timed out')
  ) {
    return { category: 'db_connection', message: 'Cannot reach the database server. Check your DATABASE_URL host and network.' };
  }
  if (msg.includes('password authentication failed') || msg.includes('authentication failed')) {
    return { category: 'db_auth', message: 'Database authentication failed. Check your DATABASE_URL username and password.' };
  }
  if (msg.includes('does not exist') && msg.includes('database')) {
    return { category: 'db_not_found', message: 'The specified database does not exist. Run `prisma db push` to create it.' };
  }
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return { category: 'db_schema', message: 'Required DB table is missing. Run `prisma db push` to apply the schema.' };
  }
  if (msg.includes('unique constraint') || msg.includes('foreign key constraint')) {
    return { category: 'db_constraint', message: err.message };
  }
  // Check for placeholder DATABASE_URL as a catch-all for unrecognised Prisma errors
  if (isDatabaseUrlPlaceholder(process.env.DATABASE_URL ?? '')) {
    return { category: 'config_invalid', message: 'DATABASE_URL is a placeholder — configure a real database.' };
  }

  return { category: 'unknown', message: err.message };
}
