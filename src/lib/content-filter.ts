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
 *  - terrorism / extremist incitement
 *
 * Safety modes:
 *  - SAFE MODE  — all adult/explicit content blocked (default)
 *  - ADULT MODE — relaxes non-harmful adult content blocks (opt-in, gated)
 *  - SUGGESTIVE MODE — allows tasteful suggestive content (lingerie, topless, etc.)
 */

import { prisma } from '@/lib/prisma'
import { getVaultApiKey } from '@/lib/brain'

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
   * When true, suggestive but non-explicit content is allowed (lingerie, bikini,
   * flirting, swearing, topless nudity only). Blocks explicit sex and illegal content.
   * Requires safeMode=false.
   */
  suggestiveMode: boolean;
}

// ── Default safety configuration ─────────────────────────────────────

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  safeMode: true,
  adultMode: false,
  suggestiveMode: false,
};

/** Runtime per-app safety overrides (write-through cache). */
const appSafetyConfigs = new Map<string, SafetyConfig>();

/**
 * Set the safety configuration for an app and persist it to the database.
 * Adult mode can only be enabled when safe mode is explicitly disabled.
 */
export function setAppSafetyConfig(appSlug: string, config: Partial<SafetyConfig>): SafetyConfig {
  const current = appSafetyConfigs.get(appSlug) ?? { ...DEFAULT_SAFETY_CONFIG };
  const updated: SafetyConfig = {
    safeMode:       config.safeMode       ?? current.safeMode,
    adultMode:      config.adultMode      ?? current.adultMode,
    suggestiveMode: config.suggestiveMode ?? current.suggestiveMode,
  };
  // Adult mode and suggestive mode both require safe mode to be off
  if (updated.adultMode && updated.safeMode) {
    updated.adultMode = false;
  }
  if (updated.suggestiveMode && updated.safeMode) {
    updated.suggestiveMode = false;
  }
  // Write to in-memory cache
  appSafetyConfigs.set(appSlug, updated);

  // Persist to DB asynchronously — fire-and-forget; in-memory is authoritative for this request
  prisma.appAiProfile
    .upsert({
      where: { appSlug },
      update: {
        safeMode:       updated.safeMode,
        adultMode:      updated.adultMode,
        suggestiveMode: updated.suggestiveMode,
      },
      create: {
        appSlug,
        appName: appSlug,
        safeMode:       updated.safeMode,
        adultMode:      updated.adultMode,
        suggestiveMode: updated.suggestiveMode,
      },
    })
    .catch((err: unknown) => {
      console.error('[content-filter] Failed to persist safety config for', appSlug, err)
    })

  return updated;
}

/**
 * Get the safety configuration for an app from the in-memory cache.
 * Use `loadAppSafetyConfigFromDB` to warm the cache from the database.
 */
export function getAppSafetyConfig(appSlug: string): SafetyConfig {
  return appSafetyConfigs.get(appSlug) ?? { ...DEFAULT_SAFETY_CONFIG };
}

/**
 * Load the safety configuration for an app from the database and warm
 * the in-memory cache. Returns the loaded config (or default if not found).
 *
 * Call this from any GET endpoint that needs to return the persisted state.
 */
export async function loadAppSafetyConfigFromDB(appSlug: string): Promise<SafetyConfig> {
  try {
    const row = await prisma.appAiProfile.findUnique({
      where: { appSlug },
      select: { safeMode: true, adultMode: true, suggestiveMode: true },
    });
    if (row) {
      const cfg: SafetyConfig = {
        safeMode:       row.safeMode,
        adultMode:      row.adultMode,
        suggestiveMode: row.suggestiveMode,
      };
      appSafetyConfigs.set(appSlug, cfg);
      return cfg;
    }
  } catch (err) {
    console.error('[content-filter] Failed to load safety config from DB for', appSlug, err)
  }
  return appSafetyConfigs.get(appSlug) ?? { ...DEFAULT_SAFETY_CONFIG };
}

// ── Keyword dictionaries ─────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<FlagCategory, RegExp[]> = {
  csam: [
    /\bchild\s+(sexual|porn|abuse|exploit)/i,
    /\b(minor|underage)\s+(sex|porn|exploit|nude|naked)/i,
    /\bpedophil/i,
    /\bchild\s+(erotica|abuse\s+material)/i,
    /\b(preteen|prepubescent)\s+(sex|porn|nude)/i,
    /\bkiddie\s+porn/i,
    /\blolicon\b/i,
    /\bshota(con)?\b/i,
    /\bmap\s+(community|rights|attraction)\b/i,       // "minor-attracted person" euphemism
    /\bage\s+of\s+consent\s+(lower|change|remove)/i,
    /\bchild\s+molest/i,
    /\bgrooming\s+(child|minor|teen|kid)/i,
    /\bsend\s+(nudes?|pics?)\s+(to\s+a\s+)?(kid|minor|child|teen)/i,
  ],
  non_consensual: [
    /\bnon[- ]?consensual\s+(sex|porn|explicit)/i,
    /\brape\s+(porn|video|fantasy|scene)/i,
    /\brevenge\s+porn/i,
    /\bsex(ual)?\s+(assault|coercion)\s+(how|instruct|guide)/i,
    /\bdrugging?\s+(for\s+sex|someone\s+for)/i,
    /\bsleep\s*raping?\b/i,
    /\bdate\s+rape\s+(drug|rohypnol|ghb)\s+(dose|how|administer)/i,
    /\bblackmail\s+(for\s+sex|into\s+sex)/i,
    /\bcoerce\s+(someone\s+)?(into\s+)?(sex|intercourse|nude)/i,
    /\bstalk(ing)?\s+(ex|someone|her|him)\s+(to|for|how)/i,
    /\bupskirt\s+(photo|video|take|record)/i,
    /\bhidden\s+camera\s+(bathroom|bedroom|shower|changing)/i,
    /\bvoyeur\s+(how|install|set\s+up)/i,
  ],
  hate_speech: [
    /\b(kill|exterminate|genocide)\s+(all\s+)?(jews|muslims|blacks|whites|gays|trans|christians|immigrants)/i,
    /\bethnic\s+cleansing/i,
    /\b(racial|ethnic)\s+supremacy/i,
    /\bhitler\s+(was\s+right|did\s+nothing\s+wrong)/i,
    /\b(jewish|muslim|black|gay)\s+(conspiracy|problem|infestation|plague)/i,
    /\b(gas|hang|lynch)\s+the\s+(jews|blacks|gays|muslims)/i,
    /\bwhite\s+genocide\b/i,
    /\b(n|k|f)[aeiou]gg[aeiou]r/i,
    /\bfinal\s+solution\s+(for|to)\s+the\s+(jewish|black|muslim|gay)/i,
    /\b(black|jewish|asian|muslim|hispanic)\s+people\s+(are|deserve|should\s+be)\s+(inferior|eliminated|deported|exterminated)/i,
    /\btransgender\s+(shouldn.t\s+exist|should\s+be\s+(killed|banned|eliminat))/i,
    /\b(inferior|subhuman)\s+race\b/i,
    /\b(kill|exterminate|deport)\s+(all\s+)?(immigrants|foreigners|refugees)\b/i,
    /\bgreat\s+replacement\s+theory\b/i,
    /\brace\s+war\s+(now|coming|start)/i,
    /\bkalergi\s+plan\b/i,
  ],
  violence: [
    /\bhow\s+to\s+(make|build|create|construct)\s+(a\s+)?(bomb|weapon|explosive|ied|grenade)/i,
    /\bmanufacture\s+(poison|toxin|bioweapon|nerve\s+agent|sarin|vx\s+nerve)/i,
    /\bsynthesize\s+(ricin|sarin|vx|anthrax)/i,
    /\b(chlorine|mustard)\s+gas\s+(synthesis|production)/i,
    /\b3d\s+print\s+(a\s+)?gun\b/i,
    /\bconvert\s+(a\s+)?(gun|rifle|pistol)\s+to\s+(full\s+)?auto/i,
    /\bhow\s+to\s+(stab|shoot|strangle|poison|bludgeon)\s+(a\s+)?(person|someone|man|woman|kid|child)/i,
    /\bhow\s+to\s+(kill|murder|assassinate)\s+(without\s+)?(getting\s+caught|leaving\s+evidence|being\s+detected)/i,
    /\bhow\s+to\s+(dispose\s+of|hide)\s+(a\s+)?(body|corpse)/i,
    /\bsilencer\s+(make|build|diy|how\s+to)/i,
    /\bghost\s+gun\s+(how|build|make|instructions)/i,
    /\buntraceable\s+(weapon|gun|knife|firearm)/i,
    /\bmail\s+bomb\s+(instructions|how|build)/i,
    /\bpipe\s+bomb\s+(make|build|instructions)/i,
    /\bfentanyl\s+(lace|poison)\s+(someone|food|drink)/i,
    /\bhire\s+(a\s+)?(hitman|assassin|killer)/i,
    /\bdark\s+web\s+(weapon|hitman|explosives?)/i,
  ],
  self_harm: [
    /\bhow\s+to\s+(commit\s+)?suicide/i,
    /\bself[- ]?harm\s+method/i,
    /\bkill\s+yourself\b/i,
    /\bsuicide\s+(method|plan|note|letter|how\s+to)/i,
    /\bmost\s+painless\s+way\s+to\s+die/i,
    /\blethal\s+dose\s+of\s+(pills|medication|drug)/i,
    /\bhow\s+to\s+(cut|slash)\s+(yourself|wrists)/i,
    /\bself-harm\s+(guide|tutorial|instruction)/i,
    /\bsuicide\s+(bridge|spot|location|jump)/i,
    /\bhow\s+many\s+(pills|tablets)\s+(to\s+)?(overdose|kill\s+yourself|die)/i,
    /\bsuicide\s+(pact|partner|together)/i,
    /\b(hang|hanging)\s+yourself\s+(how|instructions|setup)/i,
    /\bstarving\s+yourself\s+(how|tips|goal)/i,
    /\banorexia\s+(tips|thinspo|goals|pro\s*ana)/i,
    /\bpro[- ]?(ana|mia|ed)\b/i,
  ],
  terrorism: [
    /\bjoin\s+(isis|isil|al[- ]?qaeda|boko\s+haram|hamas|hezbollah)\b/i,
    /\brecruit.*\b(jiha[di]|extremis)/i,
    /\b(terror|extremis)\s+(attack|plot|cell)\s+(plan|instruct|manual)/i,
    /\bradicaliz/i,
    /\b(isis|isil|al[- ]?qaeda)\s+(manual|training|recruitment)/i,
    /\bmartyrdom\s+(operation|attack|video)/i,
    /\b(bomb|attack)\s+(airport|subway|train|school|mosque|synagogue|church)\s+(how|plan|target)/i,
    /\bwear\s+(a\s+)?(suicide|bomb)\s+vest\b/i,
    /\bactive\s+shooter\s+(guide|plan|tactic|manual)/i,
    /\bmass\s+(shooting|stabbing|attack)\s+(plan|target|how|instructions)/i,
    /\bmanifesto\s+(attack|shooting|bombing)\s+(template|write|post)/i,
    /\bfar[- ]right\s+(accelerationism|attack|cell)/i,
    /\bsolitary\s+wolf\s+(attack|bomb|shoot)/i,
    /\bvehicle\s+(ramming|attack)\s+(how|plan|target|crowd)/i,
    /\bpoison\s+(water\s+supply|food\s+supply|reservoir)\b/i,
    /\bnuclear\s+(dirty\s+bomb|device|weapon)\s+(make|build|how)/i,
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
export function scanContent(text: string, appSlug?: string): ContentFilterResult {
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

  // Apply per-app safety config if provided
  if (appSlug) {
    const result: ContentFilterResult = {
      flagged: true,
      categories: flagged,
      message: BLOCKED_MESSAGE,
      confidence: 1.0,
      scanner: 'keyword_fallback',
    };
    return applySafetyConfig(result, appSlug);
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
  const apiKey = await getVaultApiKey('openai');

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
 *
 * When suggestiveMode=true (and safeMode=false), non-ALWAYS_BLOCKED content
 * is allowed through. Since all our current FlagCategories are in ALWAYS_BLOCKED,
 * this primarily affects future categories and ensures the flag is respected.
 * More importantly, this extends to the moderation pipeline: when suggestiveMode=true,
 * OpenAI Moderation's "sexual" flag (which we don't map to our categories) is
 * not escalated, and guardrails toxicity checks do not block suggestive language.
 */
function applySafetyConfig(result: ContentFilterResult, appSlug: string): ContentFilterResult {
  // Always block these categories regardless of mode
  const alwaysBlockedCategories = result.categories.filter(c => ALWAYS_BLOCKED.includes(c));
  if (alwaysBlockedCategories.length > 0) {
    return result; // Cannot bypass these
  }

  const config = getAppSafetyConfig(appSlug);

  // In suggestive mode (non-safe), allow suggestive content that doesn't hit ALWAYS_BLOCKED
  if (!config.safeMode && config.suggestiveMode) {
    const blocked = result.categories.filter(c => ALWAYS_BLOCKED.includes(c));
    if (blocked.length === 0) {
      return { flagged: false, categories: [], message: '', confidence: 0, scanner: result.scanner };
    }
  }

  // In adult mode (non-safe), relax non-harmful adult content blocks
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
 * Covers explicit sex acts, illegal content, and minors — distinct from ALWAYS_BLOCKED
 * which covers the most severe policy violations.
 *
 * Suggestive mode ALLOWS: lingerie, bikini, flirting, swearing, topless nudity only.
 * Suggestive mode BLOCKS: explicit sex, illegal content.
 */
const SUGGESTIVE_BLOCKED_TERMS: RegExp[] = [
  // Explicit sexual acts
  /\bsex(ual)?\s+act\b/i,
  /\bintercourse\b/i,
  /\bporn(ography)?\b/i,
  /\bxxx\b/i,
  /\berotic\s+(fiction|story|art|film|video)\b/i,
  /\bsexually\s+explicit\b/i,
  /\bfull\s+frontal\s+nud/i,
  /\bgenitali[ae]\b/i,
  /\bpenis\b/i,
  /\bvagina\b/i,
  /\bvulva\b/i,
  // Minors in any suggestive context — always blocked
  /\bunderage\b/i,
  /\b(child|minor|preteen|juvenile)\s+(model|pose|photo|image|picture|lingerie|swimsuit|swimwear|bikini|in|wearing)\b/i,
  /\bteen\s+(model|pose|photo|image|picture|lingerie|swimsuit|swimwear|bikini|in|wearing)\b/i,
  /\b(child|minor|underage|teen|preteen|juvenile)\s+(sexy|suggestive|seductive|provocative)\b/i,
];

/** Terms to replace with safe alternatives when auto-rewriting a prompt. */
const SUGGESTIVE_REPLACEMENTS: [RegExp, string][] = [
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
 * Suggestive mode allows:
 *  - lingerie, bikini, swimwear
 *  - flirting, swearing
 *  - topless nudity only
 *
 * Suggestive mode blocks:
 *  - explicit sex / pornography
 *  - illegal content
 *  - minors in any suggestive context
 *
 * Rules:
 *  1. All ALWAYS_BLOCKED categories (CSAM, violence, terrorism, etc.) are blocked.
 *  2. Explicit sexual acts and minors in suggestive contexts are blocked.
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
        reason: `Prompt blocked: contains prohibited term matching "${re.source}". Suggestive mode allows lingerie, bikini, flirting, swearing, and topless nudity only — explicit sex and illegal content are blocked.`,
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
