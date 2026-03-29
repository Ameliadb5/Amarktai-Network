/**
 * Content Filter Pipeline
 *
 * Scans outputs for policy-violating content and blocks flagged material.
 * Uses keyword heuristics as the default classifier with an optional
 * integration point for the OpenAI Moderation API.
 *
 * Categories checked:
 *  - child sexual abuse material (CSAM)
 *  - non-consensual explicit content
 *  - hate speech / slurs
 *  - graphic violence / gore
 *  - self-harm / suicide instructions
 */

// ── Types ────────────────────────────────────────────────────────────

export type FlagCategory =
  | 'csam'
  | 'non_consensual'
  | 'hate_speech'
  | 'violence'
  | 'self_harm';

export interface ContentFilterResult {
  flagged: boolean;
  categories: FlagCategory[];
  message: string;
  /** Confidence 0-1 (keyword match always returns 1.0) */
  confidence: number;
}

export interface ModerationAlert {
  traceId: string;
  appSlug: string;
  category: FlagCategory;
  snippet: string;
  timestamp: string;
}

// ── Keyword dictionaries (minimal, non-exhaustive) ───────────────────

const CATEGORY_PATTERNS: Record<FlagCategory, RegExp[]> = {
  csam: [
    /\bchild\s+(sexual|porn|abuse|exploit)/i,
    /\b(minor|underage)\s+(sex|porn|exploit|nude)/i,
    /\bpedophil/i,
  ],
  non_consensual: [
    /\bnon[- ]?consensual\s+(sex|porn|explicit)/i,
    /\brape\s+(porn|video|fantasy)/i,
    /\brevenge\s+porn/i,
  ],
  hate_speech: [
    /\b(kill|exterminate|genocide)\s+(all\s+)?(jews|muslims|blacks|whites|gays|trans)/i,
    /\bethnic\s+cleansing/i,
    /\b(racial|ethnic)\s+supremacy/i,
  ],
  violence: [
    /\bhow\s+to\s+(make|build)\s+(a\s+)?(bomb|weapon|explosive)/i,
    /\bmanufacture\s+(poison|toxin|bioweapon)/i,
  ],
  self_harm: [
    /\bhow\s+to\s+(commit\s+)?suicide/i,
    /\bself[- ]?harm\s+method/i,
    /\bkill\s+yourself/i,
  ],
};

// ── Public helpers ───────────────────────────────────────────────────

const BLOCKED_MESSAGE =
  'This content has been blocked by our safety filter. If you believe this is an error, ' +
  'please contact support with your trace ID to request a review.';

/**
 * Scan a piece of text for policy-violating content.
 *
 * This is a lightweight keyword-based classifier. For production use,
 * wire in the OpenAI Moderation API or a local ML classifier by
 * replacing or augmenting this function.
 */
export function scanContent(text: string): ContentFilterResult {
  const flagged: FlagCategory[] = [];

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS) as [FlagCategory, RegExp[]][]) {
    for (const re of patterns) {
      if (re.test(text)) {
        flagged.push(category);
        break; // one match per category is sufficient
      }
    }
  }

  if (flagged.length === 0) {
    return { flagged: false, categories: [], message: '', confidence: 0 };
  }

  return {
    flagged: true,
    categories: flagged,
    message: BLOCKED_MESSAGE,
    confidence: 1.0,
  };
}

/**
 * Build a moderation alert record suitable for logging.
 */
export function buildModerationAlert(
  traceId: string,
  appSlug: string,
  result: ContentFilterResult,
  text: string,
): ModerationAlert | null {
  if (!result.flagged || result.categories.length === 0) return null;

  const snippet = text.slice(0, 200);
  return {
    traceId,
    appSlug,
    category: result.categories[0],
    snippet,
    timestamp: new Date().toISOString(),
  };
}

/**
 * User-friendly explanation of why content was blocked.
 */
export function blockedExplanation(categories: FlagCategory[]): string {
  const explanations: Record<FlagCategory, string> = {
    csam: 'Content involving minors in sexual contexts is strictly prohibited.',
    non_consensual: 'Non-consensual sexual content is not permitted.',
    hate_speech: 'Content promoting hatred or violence against groups is not allowed.',
    violence: 'Instructions for creating weapons or causing harm are prohibited.',
    self_harm: 'Content promoting self-harm or suicide is not permitted.',
  };

  const reasons = categories.map((c) => explanations[c]).filter(Boolean);
  return (
    'Your request was blocked for the following reason(s):\n' +
    reasons.map((r) => `• ${r}`).join('\n') +
    '\n\nIf you believe this is a false positive, please contact support with your trace ID ' +
    'to request a manual review. Our team will respond within 24 hours.'
  );
}
