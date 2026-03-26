/**
 * @module model-registry
 * @description Centralised model registry for the AmarktAI Network AI operating system.
 *
 * Every provider and model known to the system is declared here.
 * Routing, orchestration, and validation logic MUST read from this
 * registry instead of hard-coding model decisions elsewhere.
 *
 * Server-side only – no browser APIs or external imports.
 */

// ── Type definitions ────────────────────────────────────────────────────────

/**
 * Provider tier classification.
 *
 * - `premium`    – Layer 1: OpenAI, Grok (highest quality, highest cost)
 * - `backbone`   – Layer 2: NVIDIA, HuggingFace, Groq, DeepSeek, OpenRouter, Together
 * - `retrieval`  – Layer 3: Retrieval / Rerank specialist providers
 * - `multimodal` – Layer 4: Vision, image-generation, video-planning
 */
export type ProviderTier = 'premium' | 'backbone' | 'retrieval' | 'multimodal';

/**
 * Normalised cost classification.
 *
 * Based on approximate per-million-token pricing at time of registry creation.
 */
export type CostTier = 'free' | 'very_low' | 'low' | 'medium' | 'high' | 'premium';

/**
 * Normalised latency classification (time-to-first-token).
 *
 * - `ultra_low` – < 100 ms (e.g. Groq hardware-accelerated inference)
 * - `low`       – 100 – 300 ms
 * - `medium`    – 300 – 800 ms
 * - `high`      – > 800 ms
 */
export type LatencyTier = 'ultra_low' | 'low' | 'medium' | 'high';

/**
 * Standard role that a model can fill within the orchestration pipeline.
 */
export type ModelRole =
  | 'reasoning'
  | 'chat'
  | 'coding'
  | 'embeddings'
  | 'reranking'
  | 'creative'
  | 'validation'
  | 'agent_planning'
  | 'multilingual'
  | 'vision'
  | 'image_generation';

// ── ModelEntry interface ────────────────────────────────────────────────────

/** Full description of a model known to the AmarktAI system. */
export interface ModelEntry {
  /** Provider key, matching the keys used in vault / health-check subsystems. */
  provider: string;

  /** Provider tier classification. */
  provider_tier: ProviderTier;

  /** Model identifier sent to the provider API (e.g. `gpt-4o`). */
  model_id: string;

  /** Human-readable display name. */
  model_name: string;

  /** Model family grouping (e.g. `GPT-4`, `Llama-3`, `Mixtral`). */
  family: string;

  /** The primary role this model is best suited for. */
  primary_role: ModelRole;

  /** Additional roles the model can fill. */
  secondary_roles: ModelRole[];

  // ── Capability flags ────────────────────────────────────────────────────

  /** Supports conversational chat completions. */
  supports_chat: boolean;

  /** Supports chain-of-thought / step-by-step reasoning. */
  supports_reasoning: boolean;

  /** Specifically tuned or strong at code generation / editing. */
  supports_code: boolean;

  /** Can invoke external tools / function-calling. */
  supports_tool_use: boolean;

  /** Trained on or strong across multiple natural languages. */
  supports_multilingual: boolean;

  /** Supports JSON-mode or structured (schema-constrained) output. */
  supports_structured_output: boolean;

  /** Produces vector embeddings. */
  supports_embeddings: boolean;

  /** Can rerank a list of passages by relevance. */
  supports_reranking: boolean;

  /** Can accept and reason about image inputs. */
  supports_vision: boolean;

  /** Can generate images from text prompts. */
  supports_image_generation: boolean;

  /** Can plan or decompose video-production workflows. */
  supports_video_planning: boolean;

  /** Suitable for multi-step agent / tool-orchestration planning. */
  supports_agent_planning: boolean;

  // ── Operational metadata ──────────────────────────────────────────────

  /** Maximum context window in tokens. */
  context_window: number;

  /** Normalised latency classification. */
  latency_tier: LatencyTier;

  /** Normalised cost classification. */
  cost_tier: CostTier;

  /** Whether this model is currently enabled for routing. */
  enabled: boolean;

  /** Current operational health status. */
  health_status: 'healthy' | 'configured' | 'degraded' | 'error' | 'unconfigured' | 'disabled';

  /** Lower number = preferred fallback (1 = first choice). */
  fallback_priority: number;

  /** Whether the model may be used as a validator / second-opinion. */
  validator_eligible: boolean;

  /** Specialist knowledge domains this model excels at. */
  specialist_domains: string[];
}

// ── Registry data ───────────────────────────────────────────────────────────

/**
 * Canonical model registry.
 *
 * **Do NOT hard-code model decisions elsewhere** – always query this registry
 * via the helper functions exported below.
 */
export const MODEL_REGISTRY: readonly ModelEntry[] = [

  // ── OpenAI (Layer 1 – Premium) ──────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'gpt-4o',
    model_name: 'GPT-4o',
    family: 'GPT-4',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'agent_planning', 'vision', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: true,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: true,
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['finance', 'crypto', 'marketing', 'general', 'analysis'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'gpt-4o-mini',
    model_name: 'GPT-4o Mini',
    family: 'GPT-4',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'creative', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: true,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 128_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['general', 'chat', 'quick-tasks'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'gpt-4-turbo',
    model_name: 'GPT-4 Turbo',
    family: 'GPT-4',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'vision', 'agent_planning'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: true,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: true,
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'premium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: true,
    specialist_domains: ['finance', 'analysis', 'complex-reasoning'],
  },

  // ── Grok / xAI (Layer 1 – Premium) ─────────────────────────────────────

  {
    provider: 'grok',
    provider_tier: 'premium',
    model_id: 'grok-2-latest',
    model_name: 'Grok 2 (Latest)',
    family: 'Grok-2',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'agent_planning', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: true,
    context_window: 131_072,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: true,
    specialist_domains: ['crypto', 'real-time-data', 'analysis', 'general'],
  },
  {
    provider: 'grok',
    provider_tier: 'premium',
    model_id: 'grok-2-1212',
    model_name: 'Grok 2 (2024-12-12)',
    family: 'Grok-2',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'agent_planning'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: true,
    context_window: 131_072,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: true,
    specialist_domains: ['crypto', 'real-time-data', 'analysis'],
  },

  // ── NVIDIA (Layer 2 – Backbone) ─────────────────────────────────────────

  {
    provider: 'nvidia',
    provider_tier: 'backbone',
    model_id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    model_name: 'Llama 3.1 Nemotron 70B Instruct',
    family: 'Llama-3.1',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'agent_planning', 'validation'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: true,
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 4,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'instruction-following', 'planning'],
  },

  // ── Hugging Face (Layer 2 – Backbone) ───────────────────────────────────

  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'meta-llama/Llama-3-8b-chat-hf',
    model_name: 'Llama 3 8B Chat',
    family: 'Llama-3',
    primary_role: 'chat',
    secondary_roles: ['multilingual', 'creative'],
    supports_chat: true,
    supports_reasoning: false,
    supports_code: true,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 8_192,
    latency_tier: 'medium',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 7,
    validator_eligible: false,
    specialist_domains: ['chat', 'general', 'lightweight'],
  },
  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'mistralai/Mistral-7B-Instruct-v0.3',
    model_name: 'Mistral 7B Instruct v0.3',
    family: 'Mistral',
    primary_role: 'chat',
    secondary_roles: ['coding', 'multilingual'],
    supports_chat: true,
    supports_reasoning: false,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 32_768,
    latency_tier: 'medium',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 8,
    validator_eligible: false,
    specialist_domains: ['chat', 'code', 'instruction-following'],
  },

  // ── DeepSeek (Layer 2 – Backbone) ───────────────────────────────────────

  {
    provider: 'deepseek',
    provider_tier: 'backbone',
    model_id: 'deepseek-chat',
    model_name: 'DeepSeek Chat (V3)',
    family: 'DeepSeek-V3',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'multilingual', 'creative'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 64_000,
    latency_tier: 'medium',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: true,
    specialist_domains: ['coding', 'math', 'reasoning', 'general'],
  },
  {
    provider: 'deepseek',
    provider_tier: 'backbone',
    model_id: 'deepseek-reasoner',
    model_name: 'DeepSeek Reasoner (R1)',
    family: 'DeepSeek-R1',
    primary_role: 'reasoning',
    secondary_roles: ['coding', 'validation', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: true,
    context_window: 64_000,
    latency_tier: 'high',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 4,
    validator_eligible: true,
    specialist_domains: ['math', 'reasoning', 'science', 'coding'],
  },

  // ── Groq (Layer 2 – Backbone) ───────────────────────────────────────────

  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'llama-3.3-70b-versatile',
    model_name: 'Llama 3.3 70B Versatile (Groq)',
    family: 'Llama-3.3',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'creative', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 128_000,
    latency_tier: 'ultra_low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['general', 'chat', 'quick-tasks', 'real-time'],
  },
  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'mixtral-8x7b-32768',
    model_name: 'Mixtral 8x7B (Groq)',
    family: 'Mixtral',
    primary_role: 'chat',
    secondary_roles: ['coding', 'multilingual'],
    supports_chat: true,
    supports_reasoning: false,
    supports_code: true,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 32_768,
    latency_tier: 'ultra_low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 5,
    validator_eligible: false,
    specialist_domains: ['chat', 'multilingual', 'code'],
  },

  // ── OpenRouter (Layer 2 – Backbone / Aggregator) ────────────────────────

  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'openai/gpt-4o-mini',
    model_name: 'GPT-4o Mini via OpenRouter',
    family: 'GPT-4',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'creative'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: true,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 128_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 6,
    validator_eligible: false,
    specialist_domains: ['general', 'fallback', 'aggregator'],
  },

  // ── Together AI (Layer 2 – Backbone) ────────────────────────────────────

  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'meta-llama/Llama-3-70b-chat-hf',
    model_name: 'Llama 3 70B Chat (Together)',
    family: 'Llama-3',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'creative', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 8_192,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 6,
    validator_eligible: false,
    specialist_domains: ['general', 'open-source', 'chat'],
  },
] as const satisfies readonly ModelEntry[];

// ── Boolean capability keys (used for type-safe filtering) ──────────────

/** Keys of `ModelEntry` that hold boolean capability flags. */
type BooleanCapabilityKey = {
  [K in keyof ModelEntry]: ModelEntry[K] extends boolean ? K : never;
}[keyof ModelEntry];

// ── Helper functions ────────────────────────────────────────────────────────

/** Returns the full, immutable model registry. */
export function getModelRegistry(): readonly ModelEntry[] {
  return MODEL_REGISTRY;
}

/** Returns all models registered under `provider`. */
export function getModelsByProvider(provider: string): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

/**
 * Returns all models where a given boolean capability flag is `true`.
 *
 * @example
 * ```ts
 * const visionModels = getModelsByCapability('supports_vision');
 * ```
 */
export function getModelsByCapability(capability: BooleanCapabilityKey): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m[capability] === true);
}

/**
 * Returns models whose `primary_role` or `secondary_roles` include `role`.
 */
export function getModelsByRole(role: ModelRole): ModelEntry[] {
  return MODEL_REGISTRY.filter(
    (m) => m.primary_role === role || m.secondary_roles.includes(role),
  );
}

/**
 * Looks up a single model by provider key and model identifier.
 *
 * @returns The matching `ModelEntry`, or `undefined` if not found.
 */
export function getModelById(provider: string, modelId: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.provider === provider && m.model_id === modelId);
}

/** Returns only models that are currently enabled. */
export function getEnabledModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.enabled);
}

/** Returns models eligible to act as validators / second-opinion providers. */
export function getValidatorEligibleModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.enabled && m.validator_eligible);
}

/**
 * Returns enabled models whose `specialist_domains` include `domain`.
 *
 * @param domain - Domain string to match (e.g. `'crypto'`, `'finance'`, `'math'`, `'coding'`).
 *
 * @example
 * ```ts
 * const cryptoModels = getModelsForDomain('crypto');
 * ```
 */
export function getModelsForDomain(domain: string): ModelEntry[] {
  return MODEL_REGISTRY.filter(
    (m) => m.enabled && m.specialist_domains.includes(domain),
  );
}

// ── Cost-tier ordering (ascending) ──────────────────────────────────────

const COST_TIER_ORDER: Record<CostTier, number> = {
  free: 0,
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  premium: 5,
};

/**
 * Returns the cheapest enabled model that has `capability` set to `true`.
 *
 * Ties are broken by `fallback_priority` (lower = preferred).
 *
 * @returns A `ModelEntry` or `undefined` if no model matches.
 */
export function getCheapestModelForCapability(
  capability: BooleanCapabilityKey,
): ModelEntry | undefined {
  return getModelsByCapability(capability)
    .filter((m) => m.enabled)
    .sort(
      (a, b) =>
        COST_TIER_ORDER[a.cost_tier] - COST_TIER_ORDER[b.cost_tier] ||
        a.fallback_priority - b.fallback_priority,
    )[0];
}

/**
 * Returns the highest-quality enabled model that has `capability` set to `true`.
 *
 * "Highest quality" is determined by the most expensive cost tier first,
 * then lowest fallback priority (i.e. most preferred) as a tie-breaker.
 *
 * @returns A `ModelEntry` or `undefined` if no model matches.
 */
export function getPremiumModelForCapability(
  capability: BooleanCapabilityKey,
): ModelEntry | undefined {
  return getModelsByCapability(capability)
    .filter((m) => m.enabled)
    .sort(
      (a, b) =>
        COST_TIER_ORDER[b.cost_tier] - COST_TIER_ORDER[a.cost_tier] ||
        a.fallback_priority - b.fallback_priority,
    )[0];
}

// ── Default-model mapping (replaces scattered defaultModelFor()) ────────

/**
 * Maps each provider key to the model that should be used as the default
 * when no specific model is requested.
 *
 * This replaces the duplicated `defaultModelFor()` functions previously
 * found in `brain.ts` and `orchestrator.ts`.
 */
const DEFAULT_MODEL_MAP: Record<string, string> = {
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  openrouter: 'openai/gpt-4o-mini',
  together: 'meta-llama/Llama-3-70b-chat-hf',
  grok: 'grok-2-latest',
  huggingface: 'meta-llama/Llama-3-8b-chat-hf',
  nvidia: 'nvidia/llama-3.1-nemotron-70b-instruct',
};

/**
 * Returns the default model identifier for a given provider key.
 *
 * This is the **single source of truth** – callers should use this instead
 * of maintaining their own switch statements.
 *
 * @param providerKey - Provider key (e.g. `'openai'`, `'groq'`).
 * @returns The default model ID, or `'unknown'` for unrecognised providers.
 */
export function getDefaultModelForProvider(providerKey: string): string {
  return DEFAULT_MODEL_MAP[providerKey] ?? 'unknown';
}
