/**
 * Content Filter Pipeline
 *
 * Scans outputs for policy-violating content and blocks flagged material.
 * Uses the OpenAI Moderation API as the primary classifier, with a
 * keyword-based fallback when the API is unavailable.
 *
 * Categories checked:
 *  - child sexual abuse material (CSAM)
 *  - non-consensual explicit content
 *  - hate speech / slurs
 *  - graphic violence / gore
 *  - self-harm / suicide instructions
 *
 * Safety modes:
 *  - SAFE MODE  — all adult/explicit content blocked (default)
 *  - ADULT MODE — relaxes non-harmful adult content blocks (opt-in, gated)
 */

// ── Types ────────────────────────────────────────────────────────────

export type FlagCategory =
  | 'csam'
  | 'non_consensual'
  | 'hate_speech'
  | 'violence'
  | 'self_harm'
  | 'terrorism';

export interface ContentFilterResult {
  flagged: boolean;
  categories: FlagCategory[];
  message: string;
  /** Confidence 0-1 (keyword match always returns 1.0) */
  confidence: number;
  /** Which scanner produced the result. */
  scanner: 'openai_moderation' | 'keyword_fallback';
}

export interface ModerationAlert {
  traceId: string;
  appSlug: string;
  category: FlagCategory;
  snippet: string;
  timestamp: string;
}

/** Per-app content safety configuration. */
export interface SafetyConfig {
  /** When true, all content passes through strict safety filters (default). */
  safeMode: boolean;
  /** When true, non-harmful adult content is allowed. Requires safeMode=false. */
  adultMode: boolean;
  /**
   * When true, suggestive but non-explicit content is allowed (lingerie, swimwear,
   * fashion poses, attractive people). No nudity or explicit acts.
   * Requires safeMode=false. Less permissive than adultMode.
   */
  suggestiveMode: boolean;
}

// ── Default safety configuration ─────────────────────────────────────

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  safeMode: true,
  adultMode: false,
  suggestiveMode: false,
};

/** Runtime per-app safety overrides. */
const appSafetyConfigs = new Map<string, SafetyConfig>();

/**
 * Set the safety configuration for an app.
 * Adult mode can only be enabled when safe mode is explicitly disabled.
 */
export function setAppSafetyConfig(appSlug: string, config: Partial<SafetyConfig>): SafetyConfig {
  const current = appSafetyConfigs.get(appSlug) ?? { ...DEFAULT_SAFETY_CONFIG };
  const updated: SafetyConfig = {
    safeMode: config.safeMode ?? current.safeMode,
    adultMode: config.adultMode ?? current.adultMode,
    suggestiveMode: config.suggestiveMode ?? current.suggestiveMode,
  };
  // Adult mode and suggestive mode both require safe mode to be off
  if (updated.adultMode && updated.safeMode) {
    updated.adultMode = false;
  }
  if (updated.suggestiveMode && updated.safeMode) {
    updated.suggestiveMode = false;
  }
  appSafetyConfigs.set(appSlug, updated);
  return updated;
}

/**
 * Get the safety configuration for an app.
 */
export function getAppSafetyConfig(appSlug: string): SafetyConfig {
  return appSafetyConfigs.get(appSlug) ?? { ...DEFAULT_SAFETY_CONFIG };
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
  terrorism: [
    /\bjoin\s+(isis|isil|al[- ]?qaeda|boko\s+haram)/i,
    /\brecruit.*\b(jiha[di]|extremis)/i,
    /\b(terror|extremis)\s+(attack|plot|cell)\s+(plan|instruct|manual)/i,
    /\bradicaliz/i,
  ],
};

// ── Always-blocked categories (even in adult mode) ───────────────────

const ALWAYS_BLOCKED: FlagCategory[] = ['csam', 'non_consensual', 'violence', 'self_harm', 'hate_speech', 'terrorism'];

// ── Public helpers ───────────────────────────────────────────────────

const BLOCKED_MESSAGE =
  'This content has been blocked by our safety filter. If you believe this is an error, ' +
  'please contact support with your trace ID to request a review.';

/**
 * Keyword-based content scanner (fallback).
 *
 * This is a lightweight keyword-based classifier. For production use,
 * the OpenAI Moderation API is preferred (see scanContentWithModeration).
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
    return { flagged: false, categories: [], message: '', confidence: 0, scanner: 'keyword_fallback' };
  }

  return {
    flagged: true,
    categories: flagged,
    message: BLOCKED_MESSAGE,
    confidence: 1.0,
    scanner: 'keyword_fallback',
  };
}

/**
 * Scan content using the OpenAI Moderation API (primary), falling back to
 * keyword-based scanning when the API is unavailable.
 *
 * @param text - The text to scan
 * @param appSlug - Optional app slug to apply per-app safety config
 */
export async function scanContentWithModeration(
  text: string,
  appSlug?: string,
): Promise<ContentFilterResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Try OpenAI Moderation API first
  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: text }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results?.[0];
        if (result) {
          return mapOpenAIModerationResult(result, appSlug);
        }
      }
    } catch {
      // OpenAI API unavailable — fall through to keyword scanner
    }
  }

  // Fallback to keyword scanner
  const keywordResult = scanContent(text);

  // Apply per-app safety config
  if (appSlug && keywordResult.flagged) {
    return applySafetyConfig(keywordResult, appSlug);
  }

  return keywordResult;
}

/**
 * Map OpenAI Moderation API result to our FlagCategory system.
 */
function mapOpenAIModerationResult(
  result: { flagged: boolean; categories: Record<string, boolean> },
  appSlug?: string,
): ContentFilterResult {
  if (!result.flagged) {
    return { flagged: false, categories: [], message: '', confidence: 0, scanner: 'openai_moderation' };
  }

  const flagged: FlagCategory[] = [];

  // Map OpenAI categories to our categories
  if (result.categories['sexual/minors']) flagged.push('csam');
  if (result.categories['harassment/threatening'] || result.categories['hate/threatening']) {
    flagged.push('hate_speech');
  }
  if (result.categories['hate']) flagged.push('hate_speech');
  if (result.categories['violence/graphic'] || result.categories['violence']) flagged.push('violence');
  if (result.categories['self-harm'] || result.categories['self-harm/instructions'] || result.categories['self-harm/intent']) {
    flagged.push('self_harm');
  }
  // OpenAI does not have a dedicated terrorism category — extremist content is
  // typically caught under harassment/threatening or violence.  Our keyword
  // scanner covers terrorism patterns explicitly.

  // Deduplicate
  const unique = [...new Set(flagged)];

  if (unique.length === 0) {
    return { flagged: false, categories: [], message: '', confidence: 0, scanner: 'openai_moderation' };
  }

  const filterResult: ContentFilterResult = {
    flagged: true,
    categories: unique,
    message: BLOCKED_MESSAGE,
    confidence: 0.95,
    scanner: 'openai_moderation',
  };

  // Apply per-app safety config
  if (appSlug) {
    return applySafetyConfig(filterResult, appSlug);
  }

  return filterResult;
}

/**
 * Apply per-app safety configuration to a filter result.
 * CSAM, non-consensual, violence, self-harm, and hate speech are ALWAYS blocked.
 */
function applySafetyConfig(result: ContentFilterResult, appSlug: string): ContentFilterResult {
  // Always block these categories regardless of mode
  const alwaysBlockedCategories = result.categories.filter(c => ALWAYS_BLOCKED.includes(c));
  if (alwaysBlockedCategories.length > 0) {
    return result; // Cannot bypass these
  }

  // In non-safe + adult mode, relax non-harmful content blocks
  // (Currently all our categories are always-blocked, but this is future-ready
  //  for when adult content categories are added)
  const config = getAppSafetyConfig(appSlug);
  if (!config.safeMode && config.adultMode) {
    const blocked = result.categories.filter(c => ALWAYS_BLOCKED.includes(c));
    if (blocked.length === 0) {
      return { flagged: false, categories: [], message: '', confidence: 0, scanner: result.scanner };
    }
  }

  return result;
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
    terrorism: 'Content promoting terrorism or violent extremism is strictly prohibited.',
  };

  const reasons = categories.map((c) => explanations[c]).filter(Boolean);
  return (
    'Your request was blocked for the following reason(s):\n' +
    reasons.map((r) => `• ${r}`).join('\n') +
    '\n\nIf you believe this is a false positive, please contact support with your trace ID ' +
    'to request a manual review. Our team will respond within 24 hours.'
  );
}

// ── Suggestive content prompt guard ─────────────────────────────────────────

/**
 * Terms that are never allowed even in suggestive mode.
 * Covers nudity, explicit acts, and minors — distinct from ALWAYS_BLOCKED
 * which covers the most severe policy violations.
 */
const SUGGESTIVE_BLOCKED_TERMS: RegExp[] = [
  // Nudity / explicit exposure
  /\bnude\b/i,
  /\bnudity\b/i,
  /\bnaked\b/i,
  /\btopless\b/i,
  /\bbare\s+(chest|breasts?|nipples?|genitali[ae]|butt|buttocks|ass)\b/i,
  /\bexposed?\s+(breast|nipple|genitali[ae]|penis|vagina|vulva)\b/i,
  // Explicit sexual acts
  /\bsex(ual)?\s+act\b/i,
  /\bintercourse\b/i,
  /\bporn(ography)?\b/i,
  /\bxxx\b/i,
  /\berotic\s+(fiction|story|art|film|video)\b/i,
  /\bsexually\s+explicit\b/i,
  // Minors in any suggestive context — "underage" and "child/minor/preteen" always blocked in image context
  /\bunderage\b/i,
  /\b(child|minor|preteen|juvenile)\s+(model|pose|photo|image|picture|lingerie|swimsuit|swimwear|bikini|in|wearing)\b/i,
  // "teen" is blocked as a conservative safety measure — 13-17 are minors.
  // Legitimate 18+ content should use "adult", "woman", "man", or similar terms.
  /\bteen\s+(model|pose|photo|image|picture|lingerie|swimsuit|swimwear|bikini|in|wearing)\b/i,
  /\b(child|minor|underage|teen|preteen|juvenile)\s+(sexy|suggestive|seductive|provocative)\b/i,
];

/** Terms to replace with safe alternatives when auto-rewriting a prompt. */
const SUGGESTIVE_REPLACEMENTS: [RegExp, string][] = [
  [/\bnude\b/gi, 'tasteful'],
  [/\bnudity\b/gi, 'fashion'],
  [/\bnaked\b/gi, 'casually dressed'],
  [/\bsexy\b/gi, 'attractive'],
  [/\bseductive\b/gi, 'confident'],
  [/\bprovocative\b/gi, 'stylish'],
];

export interface SuggestivePromptValidation {
  /** Whether the prompt is allowed for suggestive generation. */
  allowed: boolean;
  /** Human-readable reason for blocking, if applicable. */
  reason?: string;
  /**
   * A sanitized version of the prompt with soft unsafe terms replaced.
   * Only populated when allowed=true (applied to the original prompt).
   * When allowed=false, equals the original prompt.
   */
  sanitized: string;
}

/**
 * Validate and sanitize a prompt intended for suggestive image/video generation.
 *
 * Rules:
 *  1. All ALWAYS_BLOCKED categories (CSAM, violence, terrorism, etc.) are blocked.
 *  2. Nudity, explicit sexual acts, and minors in suggestive contexts are blocked.
 *  3. Soft unsafe terms (e.g. "sexy") are replaced with neutral equivalents.
 *
 * Use this before sending a prompt to any image generation provider in
 * suggestive mode. If `allowed` is false, do NOT proceed with generation.
 */
export function validateSuggestivePrompt(prompt: string): SuggestivePromptValidation {
  // 1. Check ALWAYS_BLOCKED categories first
  const categoryResult = scanContent(prompt);
  if (categoryResult.flagged) {
    return {
      allowed: false,
      reason: `Prompt blocked: contains always-prohibited content (${categoryResult.categories.join(', ')}).`,
      sanitized: prompt,
    };
  }

  // 2. Check suggestive-specific blocked terms
  for (const re of SUGGESTIVE_BLOCKED_TERMS) {
    if (re.test(prompt)) {
      return {
        allowed: false,
        reason: `Prompt blocked: contains prohibited term matching "${re.source}". Suggestive mode does not allow nudity, explicit sexual acts, or minors in suggestive contexts.`,
        sanitized: prompt,
      };
    }
  }

  // 3. Apply soft replacements to sanitize the prompt
  let sanitized = prompt;
  for (const [pattern, replacement] of SUGGESTIVE_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return { allowed: true, sanitized };
}
