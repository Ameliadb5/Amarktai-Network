/**
 * @module dashboard-truth
 * @description Single source of truth for all dashboard state.
 * Every admin page/API must derive state from these functions rather than
 * computing their own version of "what is active".
 */

import {
  CANONICAL_PROVIDERS,
  type CanonicalProviderEntry,
} from './provider-catalog';
import {
  MODEL_REGISTRY,
  getModelsByProvider,
  isProviderUsable,
  getProviderHealth,
} from './model-registry';
import { getAppProfile } from './app-profiles';

// ── State enums ─────────────────────────────────────────────────────────────

export type ProviderState =
  | 'AVAILABLE_IN_CATALOG'
  | 'CONFIGURED'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'ERROR'
  | 'DISABLED';

export type CapabilityState =
  | 'AVAILABLE_NOW'
  | 'BLOCKED_BY_SETTINGS'
  | 'UNAVAILABLE_WITH_CURRENT_CONFIG'
  | 'NOT_IMPLEMENTED';

export type ImplementationState =
  | 'IMPLEMENTED_IN_PLATFORM'
  | 'AVAILABLE_IN_CATALOG'
  | 'CONFIGURED'
  | 'ACTIVE_NOW'
  | 'BLOCKED_BY_SETTINGS'
  | 'NOT_IMPLEMENTED';

// ── Lazy Prisma accessor (avoids top-level import crashes in tests) ─────────

async function getPrisma() {
  try {
    const mod = await import('./prisma');
    return mod.prisma ?? null;
  } catch {
    return null;
  }
}

// ── Provider truth ──────────────────────────────────────────────────────────

export interface ProviderTruth {
  providerKey: string;
  displayName: string;
  state: ProviderState;
  isActive: boolean;
  healthStatus: string;
  healthMessage: string;
  lastCheckedAt: string | null;
  modelCount: number;
  supportedCapabilities: string[];
}

/** Derive {@link ProviderState} from DB record fields. */
function deriveProviderState(
  dbRecord: { enabled: boolean; apiKey: string; healthStatus: string } | null,
): ProviderState {
  if (!dbRecord) return 'AVAILABLE_IN_CATALOG';
  if (!dbRecord.enabled) return 'DISABLED';
  if (!dbRecord.apiKey) return 'AVAILABLE_IN_CATALOG';

  switch (dbRecord.healthStatus) {
    case 'healthy':
      return 'HEALTHY';
    case 'degraded':
      return 'DEGRADED';
    case 'error':
      return 'ERROR';
    default:
      return 'CONFIGURED';
  }
}

/** Collect unique capability flags from a provider's models. */
function collectCapabilities(providerKey: string): string[] {
  const caps = new Set<string>();
  for (const m of getModelsByProvider(providerKey)) {
    if (m.supports_chat) caps.add('general_chat');
    if (m.supports_reasoning) caps.add('deep_reasoning');
    if (m.supports_code) caps.add('coding');
    if (m.supports_image_generation) caps.add('image_generation');
    if (m.supports_vision) caps.add('multimodal_vision');
    if (m.supports_stt) caps.add('voice_stt');
    if (m.supports_tts) caps.add('voice_tts');
    if (m.supports_voice_interaction) caps.add('realtime_voice');
    if (m.supports_embeddings) caps.add('embeddings');
    if (m.supports_reranking) caps.add('reranking');
    if (m.supports_video_planning) caps.add('video_planning');
    if (m.supports_video_generation) caps.add('video_generation');
    if (m.supports_tool_use) caps.add('tool_use');
    if (m.supports_structured_output) caps.add('structured_output');
    if (m.supports_multilingual) caps.add('multilingual');
    if (m.supports_agent_planning) caps.add('agent_planning');
  }
  return Array.from(caps).sort();
}

/**
 * Get the truth state for every canonical provider.
 * Merges catalog, DB, and in-memory health into a single view.
 */
export async function getProviderTruth(): Promise<ProviderTruth[]> {
  // Attempt to load DB records for all providers
  const dbMap = new Map<
    string,
    {
      enabled: boolean;
      apiKey: string;
      healthStatus: string;
      healthMessage: string;
      lastCheckedAt: Date | null;
    }
  >();

  try {
    const prisma = await getPrisma();
    if (prisma) {
      const rows = await prisma.aiProvider.findMany();
      for (const r of rows) {
        dbMap.set(r.providerKey, {
          enabled: r.enabled,
          apiKey: r.apiKey,
          healthStatus: r.healthStatus,
          healthMessage: r.healthMessage,
          lastCheckedAt: r.lastCheckedAt,
        });
      }
    }
  } catch {
    // DB unavailable — fall back to in-memory health only
  }

  return CANONICAL_PROVIDERS.map((cp: CanonicalProviderEntry) => {
    const db = dbMap.get(cp.key) ?? null;
    const state = deriveProviderState(db);

    // Supplement with in-memory health when DB record is absent
    const memHealth = getProviderHealth(cp.key);
    const healthStatus = db?.healthStatus ?? memHealth;
    const healthMessage = db?.healthMessage ?? '';

    return {
      providerKey: cp.key,
      displayName: cp.displayName,
      state,
      isActive: state === 'HEALTHY',
      healthStatus,
      healthMessage,
      lastCheckedAt: db?.lastCheckedAt?.toISOString() ?? null,
      modelCount: getModelsByProvider(cp.key).length,
      supportedCapabilities: collectCapabilities(cp.key),
    };
  });
}

/** Count of truly active providers (CONFIGURED + HEALTHY only). */
export async function getActiveProviderCount(): Promise<number> {
  const truth = await getProviderTruth();
  return truth.filter((p) => p.isActive).length;
}

// ── Capability truth ────────────────────────────────────────────────────────

export interface CapabilityTruth {
  capability: string;
  displayName: string;
  category: string;
  state: CapabilityState;
  implementationState: ImplementationState;
  routeExists: boolean;
  hasCapableModel: boolean;
  hasActiveProvider: boolean;
  blockedBySettings: boolean;
  reason: string;
}

/** Human-readable metadata for every known capability. */
const CAPABILITY_META: Record<
  string,
  { displayName: string; category: string; routeExists: boolean }
> = {
  general_chat: { displayName: 'General Chat', category: 'text', routeExists: true },
  deep_reasoning: { displayName: 'Deep Reasoning', category: 'text', routeExists: true },
  coding: { displayName: 'Coding Assistant', category: 'code', routeExists: true },
  image_generation: { displayName: 'Image Generation', category: 'image', routeExists: true },
  image_editing: { displayName: 'Image Editing', category: 'image', routeExists: false },
  voice_stt: { displayName: 'Speech-to-Text', category: 'voice', routeExists: true },
  voice_tts: { displayName: 'Text-to-Speech', category: 'voice', routeExists: true },
  realtime_voice: { displayName: 'Realtime Voice', category: 'voice', routeExists: false },
  research_search: { displayName: 'Research Search', category: 'research', routeExists: true },
  deep_research: { displayName: 'Deep Research', category: 'research', routeExists: true },
  reranking: { displayName: 'Reranking', category: 'retrieval', routeExists: true },
  embeddings: { displayName: 'Embeddings', category: 'retrieval', routeExists: true },
  video_planning: { displayName: 'Video Planning', category: 'video', routeExists: true },
  video_generation: { displayName: 'Video Generation', category: 'video', routeExists: false },
  suggestive_image_generation: { displayName: 'Suggestive Image Gen', category: 'adult', routeExists: true },
  suggestive_video_planning: { displayName: 'Suggestive Video Plan', category: 'adult', routeExists: true },
  suggestive_video_generation: { displayName: 'Suggestive Video Gen', category: 'adult', routeExists: false },
  multimodal_vision: { displayName: 'Vision / Multimodal', category: 'multimodal', routeExists: true },
  agent_planning: { displayName: 'Agent Planning', category: 'agent', routeExists: true },
  multilingual: { displayName: 'Multilingual', category: 'text', routeExists: true },
  structured_output: { displayName: 'Structured Output', category: 'text', routeExists: true },
  tool_use: { displayName: 'Tool Use', category: 'agent', routeExists: true },
  creative_writing: { displayName: 'Creative Writing', category: 'text', routeExists: true },
  translation: { displayName: 'Translation', category: 'text', routeExists: true },
  summarization: { displayName: 'Summarization', category: 'text', routeExists: true },
  code_review: { displayName: 'Code Review', category: 'code', routeExists: true },
};

/** Capabilities gated behind safety settings (suggestive_*). */
const SETTINGS_GATED = new Set([
  'suggestive_image_generation',
  'suggestive_video_planning',
  'suggestive_video_generation',
]);

/** Type-safe lookup of a boolean capability flag on a model entry. */
function modelHasFlag(
  m: (typeof MODEL_REGISTRY)[number],
  flag: string,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (m as any)[flag] === true;
}

/** Map capability name → model boolean flag key for quick lookup. */
const CAP_TO_MODEL_FLAG: Record<string, string> = {
  general_chat: 'supports_chat',
  deep_reasoning: 'supports_reasoning',
  coding: 'supports_code',
  image_generation: 'supports_image_generation',
  image_editing: 'supports_image_generation',
  voice_stt: 'supports_stt',
  voice_tts: 'supports_tts',
  realtime_voice: 'supports_voice_interaction',
  embeddings: 'supports_embeddings',
  reranking: 'supports_reranking',
  video_planning: 'supports_video_planning',
  video_generation: 'supports_video_generation',
  multimodal_vision: 'supports_vision',
  agent_planning: 'supports_agent_planning',
  multilingual: 'supports_multilingual',
  structured_output: 'supports_structured_output',
  tool_use: 'supports_tool_use',
  // Text-style capabilities fall back to supports_chat
  creative_writing: 'supports_chat',
  translation: 'supports_multilingual',
  summarization: 'supports_chat',
  code_review: 'supports_code',
  research_search: 'supports_tool_use',
  deep_research: 'supports_reasoning',
  suggestive_image_generation: 'supports_image_generation',
  suggestive_video_planning: 'supports_video_planning',
  suggestive_video_generation: 'supports_video_generation',
};

/**
 * Get truth for all capabilities given the current provider/model state.
 * Optionally scoped to a specific app profile to check safety toggles.
 */
export async function getCapabilityTruth(
  appSlug?: string,
): Promise<CapabilityTruth[]> {
  const providerTruth = await getProviderTruth();
  const activeProviders = new Set(
    providerTruth.filter((p) => p.isActive).map((p) => p.providerKey),
  );

  // Check app-profile safety flags for settings-gated capabilities
  const profile = appSlug ? getAppProfile(appSlug) : null;
  const suggestiveAllowed = profile?.suggestive_mode === true;

  return Object.entries(CAPABILITY_META).map(([cap, meta]) => {
    const flagKey = CAP_TO_MODEL_FLAG[cap] as keyof (typeof MODEL_REGISTRY)[number] | undefined;

    const capableModels = flagKey
      ? MODEL_REGISTRY.filter((m) => modelHasFlag(m, flagKey))
      : [];
    const hasCapableModel = capableModels.length > 0;
    const hasActiveProvider = capableModels.some((m) =>
      activeProviders.has(m.provider),
    );
    const blockedBySettings = SETTINGS_GATED.has(cap) && !suggestiveAllowed;

    // Derive states
    let state: CapabilityState;
    let implementationState: ImplementationState;
    let reason: string;

    if (!meta.routeExists) {
      state = 'NOT_IMPLEMENTED';
      implementationState = 'NOT_IMPLEMENTED';
      reason = 'No backend route exists for this capability yet.';
    } else if (blockedBySettings) {
      state = 'BLOCKED_BY_SETTINGS';
      implementationState = 'BLOCKED_BY_SETTINGS';
      reason = 'Capability is gated by safety settings (suggestive_mode).';
    } else if (hasCapableModel && hasActiveProvider) {
      state = 'AVAILABLE_NOW';
      implementationState = 'ACTIVE_NOW';
      reason = 'Route exists, capable model found, provider is active.';
    } else {
      state = 'UNAVAILABLE_WITH_CURRENT_CONFIG';
      implementationState = hasCapableModel
        ? 'AVAILABLE_IN_CATALOG'
        : 'IMPLEMENTED_IN_PLATFORM';
      reason = !hasCapableModel
        ? 'No model in the registry supports this capability.'
        : 'Provider for capable model is not active.';
    }

    return {
      capability: cap,
      displayName: meta.displayName,
      category: meta.category,
      state,
      implementationState,
      routeExists: meta.routeExists,
      hasCapableModel,
      hasActiveProvider,
      blockedBySettings,
      reason,
    };
  });
}

// ── Model truth ─────────────────────────────────────────────────────────────

export interface ModelTruth {
  provider: string;
  modelId: string;
  displayName: string;
  category: string;
  isUsableNow: boolean;
  providerState: ProviderState;
  costTier: string;
  latencyTier: string;
  capabilities: string[];
}

/**
 * Get truth for every model in the registry with its current usability.
 * Synchronous — relies on in-memory health state from model-registry.
 */
export function getModelTruth(): ModelTruth[] {
  // Pre-compute per-model capabilities to avoid O(n²) re-scanning
  return MODEL_REGISTRY.map((m) => {
    const providerHealthy = isProviderUsable(m.provider);
    const providerState: ProviderState = providerHealthy
      ? 'HEALTHY'
      : 'AVAILABLE_IN_CATALOG';

    const caps: string[] = [];
    for (const [cap, flag] of Object.entries(CAP_TO_MODEL_FLAG)) {
      if (modelHasFlag(m, flag)) caps.push(cap);
    }

    return {
      provider: m.provider,
      modelId: m.model_id,
      displayName: m.model_name,
      category: m.category,
      isUsableNow: providerHealthy && m.enabled,
      providerState,
      costTier: m.cost_tier,
      latencyTier: m.latency_tier,
      capabilities: caps,
    };
  });
}

// ── Dashboard summary ───────────────────────────────────────────────────────

export interface DashboardSummary {
  totalProviders: number;
  activeProviders: number;
  configuredProviders: number;
  totalModels: number;
  usableModels: number;
  totalCapabilities: number;
  availableCapabilities: number;
  blockedCapabilities: number;
  unavailableCapabilities: number;
  notImplemented: number;
  systemHealth: number;
}

/**
 * Aggregate dashboard summary derived entirely from the truth functions above.
 * `systemHealth` is a 0-100 weighted score:
 *   40 % — active providers / total providers
 *   35 % — available capabilities / implemented capabilities
 *   25 % — usable models / total models
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [providers, capabilities] = await Promise.all([
    getProviderTruth(),
    getCapabilityTruth(),
  ]);
  const models = getModelTruth();

  const totalProviders = providers.length;
  const activeProviders = providers.filter((p) => p.isActive).length;
  const configuredProviders = providers.filter(
    (p) => p.state !== 'AVAILABLE_IN_CATALOG',
  ).length;

  const totalModels = models.length;
  const usableModels = models.filter((m) => m.isUsableNow).length;

  const totalCapabilities = capabilities.length;
  const availableCapabilities = capabilities.filter(
    (c) => c.state === 'AVAILABLE_NOW',
  ).length;
  const blockedCapabilities = capabilities.filter(
    (c) => c.state === 'BLOCKED_BY_SETTINGS',
  ).length;
  const unavailableCapabilities = capabilities.filter(
    (c) => c.state === 'UNAVAILABLE_WITH_CURRENT_CONFIG',
  ).length;
  const notImplemented = capabilities.filter(
    (c) => c.state === 'NOT_IMPLEMENTED',
  ).length;

  // Implemented = total minus not-implemented (the denominator for cap score)
  const implementedCaps = totalCapabilities - notImplemented;
  const providerScore =
    totalProviders > 0 ? activeProviders / totalProviders : 0;
  const capScore =
    implementedCaps > 0 ? availableCapabilities / implementedCaps : 0;
  const modelScore = totalModels > 0 ? usableModels / totalModels : 0;
  const systemHealth = Math.round(
    providerScore * 40 + capScore * 35 + modelScore * 25,
  );

  return {
    totalProviders,
    activeProviders,
    configuredProviders,
    totalModels,
    usableModels,
    totalCapabilities,
    availableCapabilities,
    blockedCapabilities,
    unavailableCapabilities,
    notImplemented,
    systemHealth,
  };
}
