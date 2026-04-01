/**
 * Capability Engine — formal capability classification, routing, and fallback.
 *
 * For every incoming request the engine:
 *  1. Classifies required capability/capabilities
 *  2. Determines which configured providers/models can satisfy them
 *  3. Filters by policy, safety, budget, latency, provider health
 *  4. Ranks viable options by expected success, historical performance, cost, latency
 *  5. Selects best result-per-cost route
 *  6. Builds intelligent fallback chain
 *  7. Returns exact missing-dependency message when no route exists
 */

import {
  type ModelEntry,
  type ModelRole,
  getUsableModels,
  getModelRegistry,
  getProviderHealth,
  isProviderUsable,
  isProviderDegraded,
} from './model-registry';

// ---------------------------------------------------------------------------
// Capability classes
// ---------------------------------------------------------------------------

export type CapabilityClass =
  | 'general_chat'
  | 'deep_reasoning'
  | 'coding'
  | 'retrieval'
  | 'embeddings'
  | 'reranking'
  | 'summarization'
  | 'classification'
  | 'validation'
  | 'agent_planning'
  | 'multimodal_understanding'
  | 'image_generation'
  | 'image_editing'
  | 'video_planning'
  | 'video_generation'
  | 'voice_input'
  | 'voice_output'
  | 'realtime_voice'
  | 'adult_18plus_image'
  | 'moderation'
  | 'app_analysis'
  | 'research_search'
  | 'scraping_extraction';

export type ExecutionPreference = 'cheap' | 'balanced' | 'premium';

// ---------------------------------------------------------------------------
// Mapping: capability class → required model flags / roles
// ---------------------------------------------------------------------------

interface CapabilityRequirement {
  /** Required boolean capability flags on ModelEntry (any one satisfies) */
  anyCapabilityFlag?: (keyof ModelEntry)[];
  /** Required primary or secondary role (any one satisfies) */
  anyRole?: ModelRole[];
  /** Human-readable label used in missing-dependency messages */
  label: string;
  /** Suggested providers that commonly support this capability */
  suggestedProviders: string[];
}

const CAPABILITY_MAP: Record<CapabilityClass, CapabilityRequirement> = {
  general_chat: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'general chat',
    suggestedProviders: ['openai', 'groq', 'deepseek', 'gemini', 'huggingface'],
  },
  deep_reasoning: {
    anyCapabilityFlag: ['supports_reasoning'],
    label: 'deep reasoning',
    suggestedProviders: ['openai', 'deepseek', 'gemini'],
  },
  coding: {
    anyCapabilityFlag: ['supports_code'],
    label: 'code generation / editing',
    suggestedProviders: ['openai', 'deepseek', 'groq'],
  },
  retrieval: {
    anyCapabilityFlag: ['supports_embeddings'],
    label: 'retrieval / RAG',
    suggestedProviders: ['openai', 'huggingface', 'nvidia'],
  },
  embeddings: {
    anyCapabilityFlag: ['supports_embeddings'],
    label: 'text embeddings',
    suggestedProviders: ['openai', 'huggingface', 'nvidia'],
  },
  reranking: {
    anyCapabilityFlag: ['supports_reranking'],
    label: 'reranking',
    suggestedProviders: ['nvidia', 'huggingface'],
  },
  summarization: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'summarization',
    suggestedProviders: ['openai', 'groq', 'deepseek', 'gemini'],
  },
  classification: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'text classification',
    suggestedProviders: ['openai', 'groq', 'deepseek'],
  },
  validation: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'output validation',
    suggestedProviders: ['openai', 'deepseek', 'gemini'],
  },
  agent_planning: {
    anyCapabilityFlag: ['supports_agent_planning'],
    label: 'agent planning',
    suggestedProviders: ['openai', 'deepseek', 'gemini'],
  },
  multimodal_understanding: {
    anyCapabilityFlag: ['supports_vision'],
    label: 'multimodal / vision understanding',
    suggestedProviders: ['openai', 'gemini', 'huggingface'],
  },
  image_generation: {
    anyCapabilityFlag: ['supports_image_generation'],
    label: 'image generation',
    suggestedProviders: ['openai', 'huggingface'],
  },
  image_editing: {
    anyCapabilityFlag: ['supports_image_generation'],
    label: 'image editing',
    suggestedProviders: ['openai', 'huggingface'],
  },
  video_planning: {
    anyCapabilityFlag: ['supports_video_planning', 'supports_chat'],
    label: 'video planning / storyboarding',
    suggestedProviders: ['gemini', 'openai', 'deepseek'],
  },
  video_generation: {
    anyCapabilityFlag: ['supports_video_planning'],
    label: 'video generation',
    suggestedProviders: ['gemini'],
  },
  voice_input: {
    anyCapabilityFlag: ['supports_stt', 'supports_voice_interaction'],
    anyRole: ['voice_interaction'],
    label: 'voice / speech input (STT)',
    suggestedProviders: ['groq', 'openai'],
  },
  voice_output: {
    anyCapabilityFlag: ['supports_tts'],
    anyRole: ['tts'],
    label: 'voice / speech output (TTS)',
    suggestedProviders: ['groq', 'openai'],
  },
  realtime_voice: {
    anyCapabilityFlag: ['supports_voice_interaction'],
    label: 'realtime voice interaction',
    suggestedProviders: ['openai'],
  },
  adult_18plus_image: {
    anyCapabilityFlag: ['supports_image_generation'],
    label: 'adult 18+ image generation',
    suggestedProviders: ['huggingface'],
  },
  moderation: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'content moderation',
    suggestedProviders: ['openai'],
  },
  app_analysis: {
    anyCapabilityFlag: ['supports_reasoning', 'supports_chat'],
    label: 'app analysis / crawl',
    suggestedProviders: ['openai', 'deepseek', 'gemini'],
  },
  research_search: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'research / web search',
    suggestedProviders: ['openai', 'deepseek', 'gemini'],
  },
  scraping_extraction: {
    anyCapabilityFlag: ['supports_chat'],
    label: 'web scraping / data extraction',
    suggestedProviders: ['openai', 'deepseek'],
  },
};

// ---------------------------------------------------------------------------
// Classification: task description → required capabilities
// ---------------------------------------------------------------------------

const CLASSIFICATION_RULES: Array<{
  patterns: RegExp[];
  capabilities: CapabilityClass[];
}> = [
  { patterns: [/image.*generat/i, /generate.*image/i, /create.*image/i, /dall-?e/i, /picture/i], capabilities: ['image_generation'] },
  { patterns: [/image.*edit/i, /edit.*image/i, /modify.*image/i, /inpaint/i], capabilities: ['image_editing'] },
  { patterns: [/video.*generat/i, /generate.*video/i, /create.*video/i], capabilities: ['video_generation'] },
  { patterns: [/video.*plan/i, /plan.*video/i, /storyboard/i, /scene.*decompos/i, /reel/i, /animation/i, /video.*script/i], capabilities: ['video_planning'] },
  { patterns: [/voice.*input/i, /speech.*text/i, /stt/i, /transcri/i, /whisper/i], capabilities: ['voice_input'] },
  { patterns: [/voice.*output/i, /text.*speech/i, /tts/i, /speak/i, /narrat/i], capabilities: ['voice_output'] },
  { patterns: [/realtime.*voice/i, /voice.*chat/i, /live.*voice/i], capabilities: ['realtime_voice'] },
  { patterns: [/adult/i, /nsfw/i, /18\+/i, /explicit/i], capabilities: ['adult_18plus_image'] },
  { patterns: [/embed/i, /vector/i], capabilities: ['embeddings'] },
  { patterns: [/rerank/i, /re-rank/i], capabilities: ['reranking'] },
  { patterns: [/retriev/i, /rag/i, /search.*document/i], capabilities: ['retrieval'] },
  { patterns: [/vision/i, /multimodal/i, /describe.*image/i, /image.*understand/i], capabilities: ['multimodal_understanding'] },
  { patterns: [/agent/i, /plan/i, /tool.*use/i, /workflow/i], capabilities: ['agent_planning'] },
  { patterns: [/code/i, /program/i, /debug/i, /refactor/i, /function/i, /script/i], capabilities: ['coding'] },
  { patterns: [/reason/i, /analy/i, /math/i, /logic/i, /proof/i], capabilities: ['deep_reasoning'] },
  { patterns: [/summar/i, /brief/i, /condense/i, /digest/i, /tldr/i], capabilities: ['summarization'] },
  { patterns: [/classif/i, /categoriz/i, /label/i, /sentiment/i], capabilities: ['classification'] },
  { patterns: [/valid/i, /verify/i, /check/i, /moderate/i], capabilities: ['validation'] },
  { patterns: [/moderate/i, /filter/i, /safe/i], capabilities: ['moderation'] },
  { patterns: [/onboard/i, /discover/i, /app.*analy/i, /crawl/i, /inspect/i], capabilities: ['app_analysis'] },
  { patterns: [/research/i, /web.*search/i, /find.*info/i], capabilities: ['research_search'] },
  { patterns: [/scrap/i, /extract/i, /parse.*page/i], capabilities: ['scraping_extraction'] },
];

export function classifyCapabilities(
  taskType: string,
  message: string,
): CapabilityClass[] {
  const text = `${taskType} ${message}`.toLowerCase();
  const matched = new Set<CapabilityClass>();

  for (const rule of CLASSIFICATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        for (const cap of rule.capabilities) {
          matched.add(cap);
        }
        break; // one match per rule is enough
      }
    }
  }

  // Default: if nothing specific was detected, it is general chat
  if (matched.size === 0) {
    matched.add('general_chat');
  }
  return Array.from(matched);
}

// ---------------------------------------------------------------------------
// Capability resolution: find models that satisfy a capability
// ---------------------------------------------------------------------------

export interface CapabilityRoute {
  capability: CapabilityClass;
  /** Viable models sorted by best result-per-cost */
  models: ModelEntry[];
  /** True if at least one usable model exists */
  available: boolean;
  /** Human-readable missing-dependency message if not available */
  missingMessage: string | null;
}

function modelSatisfiesCapability(
  model: ModelEntry,
  req: CapabilityRequirement,
): boolean {
  if (req.anyCapabilityFlag) {
    for (const flag of req.anyCapabilityFlag) {
      if ((model as unknown as Record<string, unknown>)[flag] === true) return true;
    }
  }
  if (req.anyRole) {
    if (req.anyRole.includes(model.primary_role)) return true;
    for (const r of req.anyRole) {
      if (model.secondary_roles.includes(r)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cost tier ordering for sort
// ---------------------------------------------------------------------------
const COST_ORDER: Record<string, number> = {
  free: 0,
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  premium: 5,
};

const LATENCY_ORDER: Record<string, number> = {
  ultra_low: 0,
  low: 1,
  medium: 2,
  high: 3,
};

// ---------------------------------------------------------------------------
// Route resolution
// ---------------------------------------------------------------------------

export interface CapabilityRouteRequest {
  capabilities: CapabilityClass[];
  allowedProviders?: string[];
  blockedProviders?: string[];
  safeMode?: boolean;
  adultMode?: boolean;
  preference?: ExecutionPreference;
  maxCostTier?: string;
}

export interface CapabilityRouteResult {
  routes: CapabilityRoute[];
  /** True if ALL requested capabilities have at least one viable route */
  allSatisfied: boolean;
  /** Human-readable summary of any missing capabilities */
  missingCapabilities: string[];
  /** Aggregate recommendation on execution preference applied */
  appliedPreference: ExecutionPreference;
}

export function resolveCapabilityRoutes(
  request: CapabilityRouteRequest,
): CapabilityRouteResult {
  const preference = request.preference ?? 'balanced';
  const routes: CapabilityRoute[] = [];
  const missingCapabilities: string[] = [];

  for (const cap of request.capabilities) {
    const req = CAPABILITY_MAP[cap];
    if (!req) {
      routes.push({
        capability: cap,
        models: [],
        available: false,
        missingMessage: `Unknown capability class "${cap}".`,
      });
      missingCapabilities.push(`Unknown capability "${cap}".`);
      continue;
    }

    // Backend route guard: if no execution route exists, capability is unavailable
    if (!BACKEND_ROUTE_EXISTS[cap]) {
      const msg = `Route not implemented: no backend execution route exists for ${req.label}.`;
      routes.push({
        capability: cap,
        models: [],
        available: false,
        missingMessage: msg,
      });
      missingCapabilities.push(msg);
      continue;
    }

    // Adult capability guard: adult_18plus_image requires explicit adult mode
    if (cap === 'adult_18plus_image' && !request.adultMode) {
      routes.push({
        capability: cap,
        models: [],
        available: false,
        missingMessage:
          'Adult 18+ image capability requires explicit adult mode to be enabled for this app. Enable adult mode in app settings.',
      });
      missingCapabilities.push(
        'Adult 18+ image requires adult mode enabled.',
      );
      continue;
    }

    // Get all usable models
    let candidates = getUsableModels().filter((m) =>
      modelSatisfiesCapability(m, req),
    );

    // Filter by provider allow/block lists
    if (request.allowedProviders && request.allowedProviders.length > 0) {
      candidates = candidates.filter((m) =>
        request.allowedProviders!.includes(m.provider),
      );
    }
    if (request.blockedProviders && request.blockedProviders.length > 0) {
      candidates = candidates.filter(
        (m) => !request.blockedProviders!.includes(m.provider),
      );
    }

    // Filter by provider health
    candidates = candidates.filter((m) => isProviderUsable(m.provider));

    // Filter by max cost tier
    if (request.maxCostTier) {
      const maxOrder = COST_ORDER[request.maxCostTier] ?? 5;
      candidates = candidates.filter(
        (m) => (COST_ORDER[m.cost_tier] ?? 5) <= maxOrder,
      );
    }

    // Sort by preference
    candidates.sort((a, b) => {
      const costA = COST_ORDER[a.cost_tier] ?? 3;
      const costB = COST_ORDER[b.cost_tier] ?? 3;
      const latA = LATENCY_ORDER[a.latency_tier] ?? 2;
      const latB = LATENCY_ORDER[b.latency_tier] ?? 2;
      const degradedA = isProviderDegraded(a.provider) ? 1 : 0;
      const degradedB = isProviderDegraded(b.provider) ? 1 : 0;

      // Deprioritise degraded providers
      if (degradedA !== degradedB) return degradedA - degradedB;

      if (preference === 'cheap') {
        if (costA !== costB) return costA - costB;
        return latA - latB;
      }
      if (preference === 'premium') {
        if (costA !== costB) return costB - costA; // higher cost = better
        return latA - latB;
      }
      // balanced: weight cost slightly more than latency
      const scoreA = costA * 2 + latA;
      const scoreB = costB * 2 + latB;
      return scoreA - scoreB;
    });

    if (candidates.length === 0) {
      const msg = buildMissingMessage(cap, req);
      routes.push({ capability: cap, models: [], available: false, missingMessage: msg });
      missingCapabilities.push(msg);
    } else {
      routes.push({ capability: cap, models: candidates, available: true, missingMessage: null });
    }
  }

  return {
    routes,
    allSatisfied: missingCapabilities.length === 0,
    missingCapabilities,
    appliedPreference: preference,
  };
}

// ---------------------------------------------------------------------------
// Backend route existence map
// ---------------------------------------------------------------------------
// Tracks which capabilities have real, working backend execution routes.
// If a route does not exist, the capability must show UNAVAILABLE regardless
// of model/provider configuration.

const BACKEND_ROUTE_EXISTS: Record<CapabilityClass, boolean> = {
  general_chat:              true,   // /api/brain/request
  deep_reasoning:            true,   // /api/brain/request
  coding:                    true,   // /api/brain/request
  retrieval:                 true,   // /api/brain/request (retrieval_chain)
  embeddings:                true,   // /api/brain/request (embedding pipeline)
  reranking:                 false,  // internal retrieval only — no standalone API
  summarization:             true,   // /api/brain/request
  classification:            true,   // /api/brain/request
  validation:                true,   // /api/brain/request
  agent_planning:            true,   // /api/brain/request (agent_chain)
  multimodal_understanding:  true,   // /api/brain/request (multimodal_chain)
  image_generation:          true,   // /api/brain/request (DALL-E / FLUX)
  image_editing:             true,   // /api/brain/request (DALL-E)
  video_planning:            true,   // /api/brain/request (AI text — always possible via chat models)
  video_generation:          false,  // /api/brain/video route exists but returns stub — no real provider integration wired (Gemini Veo / Runway keys not processed)
  voice_input:               true,   // /api/brain/stt + /api/voice/stt (Groq Whisper / OpenAI Whisper / Gemini Live)
  voice_output:              true,   // /api/brain/tts + /api/voice/tts (Groq PlayAI / OpenAI TTS / Gemini TTS)
  realtime_voice:            false,  // no WebSocket / realtime voice endpoint
  adult_18plus_image:        false,  // no provider reliably supports unrestricted adult content
  moderation:                true,   // /api/brain/request (OpenAI moderation)
  app_analysis:              true,   // /api/brain/request
  research_search:           true,   // /api/brain/request
  scraping_extraction:       true,   // /api/brain/request
};

// ---------------------------------------------------------------------------
// Missing dependency message builder — specific diagnostics
// ---------------------------------------------------------------------------

function buildMissingMessage(
  cap: CapabilityClass,
  req: CapabilityRequirement,
): string {
  // 1. Check if backend route exists
  if (!BACKEND_ROUTE_EXISTS[cap]) {
    return `Route not implemented: no backend execution route exists for ${req.label}.`;
  }

  // 2. Check if ANY model in the full registry supports this capability
  const allModels = getModelRegistry();
  const registryModels = allModels.filter((m) =>
    m.enabled && modelSatisfiesCapability(m, req),
  );

  if (registryModels.length === 0) {
    return `No model supports this capability: no model in the registry supports ${req.label}.`;
  }

  // 3. Check provider configuration — are the required providers configured?
  const neededProviders = new Set(registryModels.map((m) => m.provider));
  const providerStatuses: string[] = [];
  let anyConfigured = false;

  for (const provider of Array.from(neededProviders)) {
    const health = getProviderHealth(provider);
    if (health === 'unconfigured' || health === 'disabled') {
      providerStatuses.push(`${provider}: not configured`);
    } else if (health === 'error') {
      providerStatuses.push(`${provider}: health check failed`);
    } else {
      anyConfigured = true;
    }
  }

  if (!anyConfigured) {
    const suggestions = req.suggestedProviders.join(', ');
    if (providerStatuses.length > 0) {
      return `No provider configured: ${req.label} requires a provider such as ${suggestions}. Status: ${providerStatuses.join('; ')}.`;
    }
    return `No provider configured: configure a supported provider (${suggestions}) to enable ${req.label}.`;
  }

  // 4. If providers are configured but still no usable models, likely a key/health issue
  const usableModels = getUsableModels().filter((m) =>
    modelSatisfiesCapability(m, req),
  );
  if (usableModels.length === 0) {
    return `Provider key missing or unhealthy: providers are configured for ${req.label} but none are currently usable. Check API keys and provider health.`;
  }

  // Fallback (shouldn't reach here in normal flow)
  const suggestions = req.suggestedProviders.join(', ');
  return (
    `${req.label} capability is not currently available from configured providers. ` +
    `Configure a supported provider such as ${suggestions} to enable ${req.label}.`
  );
}

// ---------------------------------------------------------------------------
// Convenience: single-capability quick check
// ---------------------------------------------------------------------------

export function isCapabilityAvailable(cap: CapabilityClass): boolean {
  // Fast-path: if no backend route exists, capability is never available
  if (!(cap in BACKEND_ROUTE_EXISTS) || !BACKEND_ROUTE_EXISTS[cap]) return false;
  const result = resolveCapabilityRoutes({ capabilities: [cap] });
  return result.allSatisfied;
}

export function getCapabilityStatus(): Record<CapabilityClass, boolean> {
  const all = Object.keys(CAPABILITY_MAP) as CapabilityClass[];
  const result = resolveCapabilityRoutes({ capabilities: all });
  const status: Record<string, boolean> = {};
  for (const route of result.routes) {
    status[route.capability] = route.available;
  }
  return status as Record<CapabilityClass, boolean>;
}

// ---------------------------------------------------------------------------
// Detailed capability status with reasons
// ---------------------------------------------------------------------------

export interface CapabilityStatusEntry {
  capability: CapabilityClass;
  available: boolean;
  reason: string | null;
  routeExists: boolean;
}

export function getDetailedCapabilityStatus(): CapabilityStatusEntry[] {
  const all = Object.keys(CAPABILITY_MAP) as CapabilityClass[];
  const result = resolveCapabilityRoutes({ capabilities: all });
  return result.routes.map((route) => ({
    capability: route.capability,
    available: route.available,
    reason: route.available ? null : (route.missingMessage ?? 'Unknown reason'),
    routeExists: BACKEND_ROUTE_EXISTS[route.capability] ?? false,
  }));
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------
export { CAPABILITY_MAP, BACKEND_ROUTE_EXISTS };
