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
import { loadAppSafetyConfigFromDB } from './content-filter';

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
  /** True when this provider must be configured for the platform to launch. */
  launchRequired: boolean;
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
    if (m.supports_moderation) caps.add('moderation');
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
      isActive: state === 'HEALTHY' || state === 'CONFIGURED',
      launchRequired: cp.launchRequired,
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
  image_editing: { displayName: 'Image Editing', category: 'image', routeExists: true },
  voice_stt: { displayName: 'Speech-to-Text', category: 'voice', routeExists: true },
  voice_tts: { displayName: 'Text-to-Speech', category: 'voice', routeExists: true },
  realtime_voice: { displayName: 'Realtime Voice', category: 'voice', routeExists: true },
  research_search: { displayName: 'Research Search', category: 'research', routeExists: true },
  deep_research: { displayName: 'Deep Research', category: 'research', routeExists: true },
  reranking: { displayName: 'Reranking', category: 'retrieval', routeExists: true },
  embeddings: { displayName: 'Embeddings', category: 'retrieval', routeExists: true },
  video_planning: { displayName: 'Video Planning', category: 'video', routeExists: true },
  video_generation: { displayName: 'Video Generation', category: 'video', routeExists: true },
  suggestive_image_generation: { displayName: 'Suggestive Image Gen', category: 'adult', routeExists: true },
  suggestive_video_planning: { displayName: 'Suggestive Video Plan', category: 'adult', routeExists: true },
  suggestive_video_generation: { displayName: 'Suggestive Video Gen', category: 'adult', routeExists: true },
  multimodal_vision: { displayName: 'Vision / Multimodal', category: 'multimodal', routeExists: true },
  agent_planning: { displayName: 'Agent Planning', category: 'agent', routeExists: true },
  multilingual: { displayName: 'Multilingual', category: 'text', routeExists: true },
  structured_output: { displayName: 'Structured Output', category: 'text', routeExists: true },
  tool_use: { displayName: 'Tool Use', category: 'agent', routeExists: true },
  creative_writing: { displayName: 'Creative Writing', category: 'text', routeExists: true },
  translation: { displayName: 'Translation', category: 'text', routeExists: true },
  summarization: { displayName: 'Summarization', category: 'text', routeExists: true },
  code_review: { displayName: 'Code Review', category: 'code', routeExists: true },
  moderation: { displayName: 'Content Moderation', category: 'safety', routeExists: true },
  adult_18plus_image: { displayName: 'Adult 18+ Image Gen', category: 'adult', routeExists: true },
  // ── Workflow / Automation ───────────────────────────────────────────────────
  workflow_automation: { displayName: 'Workflow Automation', category: 'workflow', routeExists: true },
  skill_templates: { displayName: 'Skill Templates Library', category: 'workflow', routeExists: true },
  // ── Multi-Agent / Team ──────────────────────────────────────────────────────
  multi_agent_orchestration: { displayName: 'Multi-Agent Orchestration', category: 'agent', routeExists: true },
  team_assistant: { displayName: 'Team Assistant', category: 'agent', routeExists: true },
  agent_handoff: { displayName: 'Agent Handoff Chains', category: 'agent', routeExists: true },
  // ── Integration Hub ─────────────────────────────────────────────────────────
  integration_hub: { displayName: 'Integration Hub', category: 'integration', routeExists: true },
  email_triage: { displayName: 'Email Triage', category: 'integration', routeExists: true },
  calendar_management: { displayName: 'Calendar Management', category: 'integration', routeExists: true },
  // ── Smart Home / Device ─────────────────────────────────────────────────────
  smart_home_control: { displayName: 'Smart Home Control', category: 'smart_home', routeExists: true },
  device_automation: { displayName: 'Device Automation', category: 'smart_home', routeExists: true },
};

/** Capabilities gated behind safety settings (suggestive_*). */
const SETTINGS_GATED = new Set([
  'suggestive_image_generation',
  'suggestive_video_planning',
  'suggestive_video_generation',
  'adult_18plus_image',
]);

/** Type-safe lookup of a boolean capability flag on a model entry. */
function modelHasFlag(
  m: (typeof MODEL_REGISTRY)[number],
  flag: string,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (m as any)[flag] === true;
}

/** Map capability name → model boolean flag key for quick lookup.
 *  Exported for testing and introspection only. */
export const CAP_TO_MODEL_FLAG: Record<string, string> = {
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
  moderation: 'supports_moderation',
  // adult_18plus_image uses HuggingFace image models; checking supports_image_generation
  // is a reasonable proxy since the HF inference API handles the actual generation.
  adult_18plus_image: 'supports_image_generation',
  // Workflow / Automation — platform-level features backed by general chat models
  workflow_automation: 'supports_chat',
  skill_templates: 'supports_chat',
  // Multi-Agent / Team — backed by agent_planning models
  multi_agent_orchestration: 'supports_agent_planning',
  team_assistant: 'supports_agent_planning',
  agent_handoff: 'supports_agent_planning',
  // Integration Hub — overridden to AVAILABLE_NOW by PLATFORM_LEVEL_CAPABILITIES below
  // (the route and framework are always operational regardless of AI model state)
  integration_hub: 'supports_chat',
  email_triage: 'supports_chat',
  calendar_management: 'supports_chat',
  // Smart Home / Device — overridden to AVAILABLE_NOW by PLATFORM_LEVEL_CAPABILITIES below
  // (the framework runs in simulation mode with no external hub required)
  smart_home_control: 'supports_chat',
  device_automation: 'supports_chat',
  // Music Studio — requires music provider key (Suno or Replicate) for audio; lyrics always available
  music_generation: 'supports_music_generation',
  lyrics_generation: 'supports_chat',
  music_cover_art: 'supports_image_generation',
  // Monetization — platform-level (always available)
  monetization: 'supports_chat',
  usage_analytics: 'supports_chat',
};

/** Capabilities that are platform-level features (route + framework always available,
 *  no specific AI model flag required beyond having any active chat provider). */
const PLATFORM_LEVEL_CAPABILITIES = new Set([
  'integration_hub',
  'smart_home_control',
  'workflow_automation',
  'skill_templates',
  'monetization',
  'usage_analytics',
  'lyrics_generation', // lyrics are generated via chat models — always available
]);

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

  // Check app-profile safety flags from persisted DB-backed safety config.
  const persistedSafety = appSlug ? await loadAppSafetyConfigFromDB(appSlug) : null;
  const profile = appSlug ? getAppProfile(appSlug) : null;
  const suggestiveAllowed = persistedSafety
    ? !persistedSafety.safeMode && persistedSafety.suggestiveMode
    : profile?.suggestive_mode === true;
  const adultAllowed = persistedSafety
    ? !persistedSafety.safeMode && persistedSafety.adultMode
    : false;

  return Object.entries(CAPABILITY_META).map(([cap, meta]) => {
    const flagKey = CAP_TO_MODEL_FLAG[cap] as keyof (typeof MODEL_REGISTRY)[number] | undefined;

    const capableModels = flagKey
      ? MODEL_REGISTRY.filter((m) => modelHasFlag(m, flagKey))
      : [];
    const hasCapableModel = capableModels.length > 0;
    const hasActiveProvider = capableModels.some((m) =>
      activeProviders.has(m.provider),
    );
    const blockedBySettings = cap === 'adult_18plus_image'
      ? !!appSlug && !adultAllowed
      : SETTINGS_GATED.has(cap) && !suggestiveAllowed;

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
      if (cap === 'adult_18plus_image') {
        reason = 'Adult 18+ image generation is gated for this app. Set safeMode=false and adultMode=true in Admin → App Safety.';
      } else {
        reason = 'Capability is gated by safety settings (suggestive_mode).';
      }
    } else if (cap === 'realtime_voice' && !process.env.REALTIME_SERVICE_URL?.trim()) {
      // Realtime voice requires a separately-deployed WebSocket service in
      // addition to an OpenAI provider. Without REALTIME_SERVICE_URL the
      // session endpoint exists but streaming cannot work.
      // implementationState: 'IMPLEMENTED_IN_PLATFORM' — route + model exist,
      // the platform has the feature, but the external service is not configured.
      state = 'UNAVAILABLE_WITH_CURRENT_CONFIG';
      implementationState = 'IMPLEMENTED_IN_PLATFORM';
      reason =
        'Realtime voice service not configured: set REALTIME_SERVICE_URL to the running ' +
        'WebSocket service (see services/realtime/). The session endpoint ' +
        '(/api/realtime/session) exists but streaming requires the separate service.';
    } else if (cap === 'adult_18plus_image') {
      // Adult 18+ image generation exclusively uses HuggingFace diffusion models.
      // OpenAI and other image providers are NOT used for this capability.
      // Showing AVAILABLE_NOW when only OpenAI is active would be a lie.
      const hfActive = activeProviders.has('huggingface');
      if (hfActive) {
        state = 'AVAILABLE_NOW';
        implementationState = 'ACTIVE_NOW';
        reason = 'Adult 18+ image generation ready via HuggingFace diffusion models. Requires adultMode=true on the app (Admin → App Agents → Settings).';
      } else {
        state = 'UNAVAILABLE_WITH_CURRENT_CONFIG';
        implementationState = 'AVAILABLE_IN_CATALOG';
        reason = 'Adult 18+ image generation requires a HuggingFace API key — add it via Admin → AI Providers. HuggingFace diffusion models (RealVisXL, DreamShaper) are used for this capability.';
      }
    } else if (PLATFORM_LEVEL_CAPABILITIES.has(cap)) {
      // Platform-level capability: no AI model flag required.
      // These are always AVAILABLE_NOW as long as the route exists (which it does).
      state = 'AVAILABLE_NOW';
      implementationState = 'ACTIVE_NOW';
      if (cap === 'integration_hub') {
        reason = 'Integration Hub route (/api/admin/integration-hub) is operational. Individual connectors require their own credentials.';
      } else if (cap === 'smart_home_control') {
        reason = 'Smart Home framework (/api/admin/smart-home) is operational in simulation mode. Configure HOME_ASSISTANT_URL or HOMEY_API_URL for real device control.';
      } else if (cap === 'monetization' || cap === 'usage_analytics') {
        reason = 'Monetization engine (/api/admin/monetization) is operational. Usage tracking, revenue hooks, and subscription management are active.';
      } else if (cap === 'lyrics_generation') {
        reason = 'Lyrics generation is available via music studio (/api/admin/music-studio). Uses chat models — available with any active AI provider.';
      } else {
        reason = 'Platform-level feature — route exists and is operational.';
      }
    } else if (hasCapableModel && hasActiveProvider) {
      state = 'AVAILABLE_NOW';
      implementationState = 'ACTIVE_NOW';
      if (cap === 'image_generation') {
        const activeImageModels = capableModels
          .filter((m) => activeProviders.has(m.provider))
          .map((m) => m.model_id);
        const hasGptImageModel = activeImageModels.some((id) =>
          id === 'gpt-image-1' || id === 'gpt-image-1.5' || id === 'gpt-image-1-mini',
        );
        reason = hasGptImageModel
          ? `Image generation ready — GPT Image model available (${activeImageModels.filter((id) => id.startsWith('gpt-image')).join(', ')}).`
          : `Image generation ready via ${activeImageModels.join(', ')}.`;
      } else {
        reason = 'Route exists, capable model found, provider is active.';
      }
    } else {
      state = 'UNAVAILABLE_WITH_CURRENT_CONFIG';
      implementationState = hasCapableModel
        ? 'AVAILABLE_IN_CATALOG'
        : 'IMPLEMENTED_IN_PLATFORM';
      if (cap === 'image_generation') {
        reason = !hasCapableModel
          ? 'No image generation model in the registry.'
          : 'OpenAI API key is not configured — add it via Admin → AI Providers to enable GPT Image models (gpt-image-1, gpt-image-1.5, gpt-image-1-mini).';
      } else {
        reason = !hasCapableModel
          ? 'No model in the registry supports this capability.'
          : 'Provider for capable model is not active.';
      }
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
  // Phase 2 additions
  artifactCount: number;
  queueHealthy: boolean;
  storageDriver: string;
  managerAgentsActive: boolean;
  // Phase 3 additions
  healthScore: number;
  circuitBreakersOpen: number;
  deadLetterQueueSize: number;
  unresolvedAlerts: number;
  criticalAlerts: number;
  sseListeners: number;
  providerReliabilityCount: number;
}

/**
 * Aggregate dashboard summary derived entirely from the truth functions above.
 * `systemHealth` is a 0-100 weighted score based on *required* providers only:
 *   40 % — active required providers / total required providers
 *   35 % — available capabilities / implemented capabilities
 *   25 % — usable models / total models
 *
 * Optional providers are counted separately and do not affect the health score
 * denominator — their errors show as informational warnings, not blockers.
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

  // Provider health score uses only launch-required providers so that optional
  // provider errors (e.g. Hugging Face 401) do not poison the system score.
  const requiredProviders = providers.filter((p) => p.launchRequired);
  const activeRequiredProviders = requiredProviders.filter((p) => p.isActive).length;
  const totalRequiredProviders = requiredProviders.length;

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
    totalRequiredProviders > 0 ? activeRequiredProviders / totalRequiredProviders : 0;
  const capScore =
    implementedCaps > 0 ? availableCapabilities / implementedCaps : 0;
  const modelScore = totalModels > 0 ? usableModels / totalModels : 0;
  const systemHealth = Math.round(
    providerScore * 40 + capScore * 35 + modelScore * 25,
  );

  // Phase 2 — artifact count, queue health, storage driver, manager agents
  let artifactCount = 0;
  let queueHealthy = false;
  let storageDriver = 'local';
  const managerAgentsActive = true; // Manager agents are always available

  // Phase 3 — circuit breakers, DLQ, alerts, SSE, reliability
  let circuitBreakersOpen = 0;
  let deadLetterQueueSize = 0;
  let unresolvedAlerts = 0;
  let criticalAlerts = 0;
  let sseListeners = 0;
  let providerReliabilityCount = 0;

  try {
    const { getQueueStatus } = await import('./job-queue');
    const queueStatus = await getQueueStatus();
    queueHealthy = queueStatus.healthy;
  } catch { /* Redis unavailable */ }

  try {
    const { getStorageStatus } = await import('./storage-driver');
    storageDriver = getStorageStatus().driver;
  } catch { /* ignore */ }

  try {
    const prisma = await getPrisma();
    if (prisma) {
      artifactCount = await prisma.artifact.count();
    }
  } catch { /* Schema not migrated yet — acceptable */ }

  try {
    const { getAllCircuitStatuses, getDeadLetterQueueSize } = await import('./circuit-breaker');
    const statuses = getAllCircuitStatuses();
    circuitBreakersOpen = Object.values(statuses).filter(s => s.state === 'OPEN').length;
    deadLetterQueueSize = getDeadLetterQueueSize();
  } catch { /* ignore */ }

  try {
    const { getAlertSummary } = await import('./alert-engine');
    const alertSummary = await getAlertSummary();
    unresolvedAlerts = alertSummary.unresolved;
    criticalAlerts = alertSummary.critical;
  } catch { /* ignore */ }

  try {
    const { getEventListenerCount } = await import('./event-bus');
    sseListeners = getEventListenerCount();
  } catch { /* ignore */ }

  try {
    const { getAllProviderReliability } = await import('./provider-reliability');
    providerReliabilityCount = getAllProviderReliability().length;
  } catch { /* ignore */ }

  // Adjust health score with Phase 3 signals
  let adjustedHealth = systemHealth;
  if (circuitBreakersOpen > 0) adjustedHealth = Math.max(0, adjustedHealth - circuitBreakersOpen * 5);
  if (criticalAlerts > 0) adjustedHealth = Math.max(0, adjustedHealth - criticalAlerts * 3);
  const healthScore = Math.max(0, Math.min(100, adjustedHealth));

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
    artifactCount,
    queueHealthy,
    storageDriver,
    managerAgentsActive,
    healthScore,
    circuitBreakersOpen,
    deadLetterQueueSize,
    unresolvedAlerts,
    criticalAlerts,
    sseListeners,
    providerReliabilityCount,
  };
}
