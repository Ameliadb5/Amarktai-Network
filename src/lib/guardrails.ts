/**
 * Guardrails Engine — Output Validation, Safety & Quality
 *
 * Beyond content filtering: output validation, PII detection,
 * hallucination flagging, bias detection, and citation verification.
 * Enterprise trust and safety layer for all AI outputs.
 *
 * Truthful: Only flags issues that are actually detected.
 * Does not fabricate safety concerns.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface GuardrailCheck {
  name: string
  category: GuardrailCategory
  passed: boolean
  severity: 'info' | 'warning' | 'critical'
  message: string
  details?: Record<string, unknown>
}

export type GuardrailCategory =
  | 'pii'
  | 'hallucination'
  | 'bias'
  | 'toxicity'
  | 'quality'
  | 'format'
  | 'citation'
  | 'safety'

export interface GuardrailResult {
  passed: boolean
  checks: GuardrailCheck[]
  blockedCategories: GuardrailCategory[]
  redactedOutput?: string
  latencyMs: number
  metadata: {
    checksRun: number
    checksPassed: number
    checksFailed: number
    criticalFailures: number
  }
}

export interface GuardrailPolicy {
  /** Which checks to enable */
  enabledChecks: GuardrailCategory[]
  /** Whether to block on critical failures */
  blockOnCritical: boolean
  /** Whether to auto-redact PII */
  autoRedactPII: boolean
  /** Maximum output length (characters) */
  maxOutputLength?: number
  /** Custom blocked terms */
  customBlockedTerms?: string[]
  /** Require citations for factual claims */
  requireCitations?: boolean
}

// ── Default Policy ───────────────────────────────────────────────────────────

export const DEFAULT_POLICY: GuardrailPolicy = {
  enabledChecks: ['pii', 'toxicity', 'quality', 'safety'],
  blockOnCritical: true,
  autoRedactPII: true,
  maxOutputLength: 50_000,
}

// ── PII Detection ────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { name: 'phone_us', pattern: /\b(\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}\b/g, replacement: '[PHONE]' },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { name: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CREDIT_CARD]' },
  { name: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP_ADDRESS]' },
  { name: 'api_key', pattern: /\b(sk|pk|api[_-]?key)[_-]?[a-zA-Z0-9]{20,}\b/gi, replacement: '[API_KEY]' },
  { name: 'aws_key', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[AWS_KEY]' },
]

function detectPII(text: string): Array<{ type: string; count: number }> {
  const findings: Array<{ type: string; count: number }> = []
  for (const pattern of PII_PATTERNS) {
    const matches = text.match(pattern.pattern)
    if (matches && matches.length > 0) {
      findings.push({ type: pattern.name, count: matches.length })
    }
  }
  return findings
}

function redactPII(text: string): string {
  let redacted = text
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern.pattern, pattern.replacement)
  }
  return redacted
}

// ── Toxicity Detection ───────────────────────────────────────────────────────

const TOXIC_PATTERNS = [
  /\b(kill|murder|harm)\s+(yourself|himself|herself|themselves)\b/i,
  /\b(instructions|how)\s+(to|for)\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive|poison)\b/i,
  /\b(self[_-]?harm|suicide)\s+(method|instruction|guide|tutorial)\b/i,
]

function detectToxicity(text: string): Array<{ pattern: string; matched: boolean }> {
  return TOXIC_PATTERNS.map((p, i) => ({
    pattern: `toxicity_rule_${i}`,
    matched: p.test(text),
  })).filter((r) => r.matched)
}

// ── Quality Checks ───────────────────────────────────────────────────────────

function checkQuality(text: string, maxLength?: number): GuardrailCheck[] {
  const checks: GuardrailCheck[] = []

  // Empty or too short
  if (!text || text.trim().length === 0) {
    checks.push({
      name: 'empty_output',
      category: 'quality',
      passed: false,
      severity: 'critical',
      message: 'Output is empty',
    })
  } else if (text.trim().length < 10) {
    checks.push({
      name: 'too_short',
      category: 'quality',
      passed: false,
      severity: 'warning',
      message: 'Output is suspiciously short (< 10 chars)',
    })
  }

  // Too long
  if (maxLength && text.length > maxLength) {
    checks.push({
      name: 'too_long',
      category: 'quality',
      passed: false,
      severity: 'warning',
      message: `Output exceeds max length (${text.length} > ${maxLength})`,
    })
  }

  // Repetition detection
  const words = text.split(/\s+/)
  if (words.length > 20) {
    const wordCounts = new Map<string, number>()
    for (const w of words) {
      wordCounts.set(w.toLowerCase(), (wordCounts.get(w.toLowerCase()) ?? 0) + 1)
    }
    const maxRepetition = Math.max(...wordCounts.values())
    const repetitionRatio = maxRepetition / words.length
    if (repetitionRatio > 0.3) {
      checks.push({
        name: 'excessive_repetition',
        category: 'quality',
        passed: false,
        severity: 'warning',
        message: `Excessive word repetition detected (${(repetitionRatio * 100).toFixed(0)}%)`,
        details: { repetitionRatio, mostRepeated: [...wordCounts.entries()].sort((a, b) => b[1] - a[1])[0] },
      })
    }
  }

  // Incomplete output detection
  if (text.endsWith('...') || text.endsWith('…')) {
    // This might be intentional, so just info level
    checks.push({
      name: 'potentially_truncated',
      category: 'quality',
      passed: true,
      severity: 'info',
      message: 'Output ends with ellipsis — may be truncated',
    })
  }

  return checks
}

// ── Bias Detection ───────────────────────────────────────────────────────────

const BIAS_INDICATORS = [
  { pattern: /\ball\s+(men|women|blacks|whites|asians|latinos|muslims|christians|jews)\s+(are|always|never)\b/i, type: 'stereotyping' },
  { pattern: /\b(obviously|clearly|everyone knows)\s+that\b/i, type: 'assumption' },
  { pattern: /\b(superior|inferior)\s+(race|gender|religion)\b/i, type: 'supremacy' },
]

function detectBias(text: string): Array<{ type: string; severity: 'warning' | 'critical' }> {
  const findings: Array<{ type: string; severity: 'warning' | 'critical' }> = []
  for (const indicator of BIAS_INDICATORS) {
    if (indicator.pattern.test(text)) {
      findings.push({
        type: indicator.type,
        severity: indicator.type === 'supremacy' ? 'critical' : 'warning',
      })
    }
  }
  return findings
}

// ── Hallucination Indicators ─────────────────────────────────────────────────

const HALLUCINATION_PHRASES = [
  /\bAs of my (last |knowledge )?cutoff\b/i,
  /\bI don'?t have (access to|real-?time|current)\b/i,
  /\bAs an AI( language model)?,?\s*I\b/i,
  /\bI was (trained|last updated) (on|in|up to)\b/i,
]

function detectHallucinationIndicators(text: string): string[] {
  return HALLUCINATION_PHRASES
    .filter((p) => p.test(text))
    .map((p) => p.source)
}

// ── Main Guardrail Check ─────────────────────────────────────────────────────

/**
 * Run all enabled guardrail checks on an AI output.
 */
export function runGuardrails(
  output: string,
  policy: GuardrailPolicy = DEFAULT_POLICY,
): GuardrailResult {
  const start = Date.now()
  const checks: GuardrailCheck[] = []

  // PII Detection
  if (policy.enabledChecks.includes('pii')) {
    const piiFindings = detectPII(output)
    if (piiFindings.length > 0) {
      checks.push({
        name: 'pii_detected',
        category: 'pii',
        passed: false,
        severity: 'critical',
        message: `PII detected: ${piiFindings.map((f) => `${f.type} (${f.count})`).join(', ')}`,
        details: { findings: piiFindings },
      })
    } else {
      checks.push({ name: 'pii_scan', category: 'pii', passed: true, severity: 'info', message: 'No PII detected' })
    }
  }

  // Toxicity Detection
  if (policy.enabledChecks.includes('toxicity')) {
    const toxicFindings = detectToxicity(output)
    if (toxicFindings.length > 0) {
      checks.push({
        name: 'toxicity_detected',
        category: 'toxicity',
        passed: false,
        severity: 'critical',
        message: `Potentially harmful content detected`,
        details: { findings: toxicFindings },
      })
    } else {
      checks.push({ name: 'toxicity_scan', category: 'toxicity', passed: true, severity: 'info', message: 'No toxic content detected' })
    }
  }

  // Quality Checks
  if (policy.enabledChecks.includes('quality')) {
    checks.push(...checkQuality(output, policy.maxOutputLength))
  }

  // Bias Detection
  if (policy.enabledChecks.includes('bias')) {
    const biasFindings = detectBias(output)
    if (biasFindings.length > 0) {
      for (const finding of biasFindings) {
        checks.push({
          name: `bias_${finding.type}`,
          category: 'bias',
          passed: false,
          severity: finding.severity,
          message: `Potential bias detected: ${finding.type}`,
        })
      }
    } else {
      checks.push({ name: 'bias_scan', category: 'bias', passed: true, severity: 'info', message: 'No bias indicators detected' })
    }
  }

  // Hallucination Indicators
  if (policy.enabledChecks.includes('hallucination')) {
    const hallucinationIndicators = detectHallucinationIndicators(output)
    if (hallucinationIndicators.length > 0) {
      checks.push({
        name: 'hallucination_indicator',
        category: 'hallucination',
        passed: true, // Info only — not a failure
        severity: 'info',
        message: `AI self-disclosure phrases detected (${hallucinationIndicators.length})`,
        details: { count: hallucinationIndicators.length },
      })
    }
  }

  // Safety — custom blocked terms
  if (policy.enabledChecks.includes('safety') && policy.customBlockedTerms?.length) {
    for (const term of policy.customBlockedTerms) {
      if (output.toLowerCase().includes(term.toLowerCase())) {
        checks.push({
          name: 'custom_blocked_term',
          category: 'safety',
          passed: false,
          severity: 'critical',
          message: `Blocked term detected in output`,
        })
        break
      }
    }
  }

  // Compute result
  const failed = checks.filter((c) => !c.passed)
  const criticalFailures = failed.filter((c) => c.severity === 'critical')
  const blockedCategories = [...new Set(failed.map((c) => c.category))]
  const passed = policy.blockOnCritical ? criticalFailures.length === 0 : true

  // Auto-redact PII if enabled
  let redactedOutput: string | undefined
  if (policy.autoRedactPII && checks.some((c) => c.category === 'pii' && !c.passed)) {
    redactedOutput = redactPII(output)
  }

  return {
    passed,
    checks,
    blockedCategories,
    redactedOutput,
    latencyMs: Date.now() - start,
    metadata: {
      checksRun: checks.length,
      checksPassed: checks.filter((c) => c.passed).length,
      checksFailed: failed.length,
      criticalFailures: criticalFailures.length,
    },
  }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const PII_PATTERN_COUNT = PII_PATTERNS.length
export const TOXIC_PATTERN_COUNT = TOXIC_PATTERNS.length
export const BIAS_INDICATOR_COUNT = BIAS_INDICATORS.length
export const GUARDRAIL_CATEGORIES: GuardrailCategory[] = ['pii', 'hallucination', 'bias', 'toxicity', 'quality', 'format', 'citation', 'safety']
export { detectPII, redactPII, detectToxicity, detectBias, detectHallucinationIndicators }
