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
  | 'image_generation'
  | 'tts'
  | 'voice_interaction';

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

  /** Can transcribe speech / audio to text (STT). */
  supports_stt?: boolean;

  /** Can generate speech / audio from text (TTS). */
  supports_tts?: boolean;

  /** Can engage in real-time speech interaction (STT+TTS). */
  supports_voice_interaction?: boolean;

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
    supports_video_planning: true,
    supports_agent_planning: true,
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['finance', 'crypto', 'marketing', 'general', 'analysis', 'video_planning'],
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

  // ── OpenAI — reasoning / o-series ────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'o1',
    model_name: 'o1 (Flagship Reasoning)',
    family: 'o1',
    primary_role: 'reasoning',
    secondary_roles: ['coding', 'validation', 'agent_planning'],
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
    context_window: 200_000,
    latency_tier: 'high',
    cost_tier: 'premium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['math', 'science', 'complex-reasoning', 'security', 'trading'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'o3-mini',
    model_name: 'o3 Mini (Fast Reasoning)',
    family: 'o3',
    primary_role: 'reasoning',
    secondary_roles: ['coding', 'validation'],
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
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: true,
    specialist_domains: ['math', 'coding', 'reasoning', 'security', 'trading'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'o1-mini',
    model_name: 'o1 Mini',
    family: 'o1',
    primary_role: 'reasoning',
    secondary_roles: ['coding'],
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
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['coding', 'math', 'reasoning'],
  },

  // ── OpenAI — embeddings ───────────────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'text-embedding-3-large',
    model_name: 'Text Embedding 3 Large',
    family: 'text-embedding-3',
    primary_role: 'embeddings',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: true,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 8_191,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'semantic-search', 'rag'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'text-embedding-3-small',
    model_name: 'Text Embedding 3 Small',
    family: 'text-embedding-3',
    primary_role: 'embeddings',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: true,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 8_191,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'semantic-search', 'rag'],
  },

  // ── OpenAI — image generation ─────────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'dall-e-3',
    model_name: 'DALL·E 3',
    family: 'DALL-E',
    primary_role: 'image_generation',
    secondary_roles: ['creative'],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: true,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'high',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['marketing', 'creative', 'design', 'travel'],
  },

  // ── OpenAI — text-to-speech ───────────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'tts-1',
    model_name: 'TTS-1',
    family: 'TTS',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'friends', 'travel', 'marketing'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'tts-1-hd',
    model_name: 'TTS-1 HD',
    family: 'TTS',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'medium',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'friends', 'travel', 'marketing', 'secure'],
  },

  // ── OpenAI — speech-to-text ─────────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'whisper-1',
    model_name: 'Whisper-1',
    family: 'Whisper',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 25_000, // ~30 min audio at whisper rates
    latency_tier: 'medium',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'multilingual'],
  },

  // ── Groq — speech-to-text (low cost) ────────────────────────────────────

  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'whisper-large-v3',
    model_name: 'Whisper Large v3 (Groq)',
    family: 'Whisper',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 25_000, // ~30 min audio at whisper rates
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'multilingual'],
  },
  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'distil-whisper-large-v3-en',
    model_name: 'Distil-Whisper Large v3 EN (Groq)',
    family: 'Whisper',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 25_000, // ~30 min audio at whisper rates
    latency_tier: 'ultra_low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'english'],
  },
  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'whisper-large-v3-turbo',
    model_name: 'Whisper Large v3 Turbo (Groq)',
    family: 'Whisper',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 25_000, // ~30 min audio at whisper rates
    latency_tier: 'ultra_low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'multilingual', 'fast_stt'],
  },

  // ── Groq — text-to-speech (low cost) ────────────────────────────────────

  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'playai-tts',
    model_name: 'PlayAI TTS (Groq)',
    family: 'PlayAI',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'fast_tts'],
  },
  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'playai-tts-arabic',
    model_name: 'PlayAI TTS Arabic (Groq)',
    family: 'PlayAI',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'arabic', 'fast_tts'],
  },

  // ── Gemini (Google) ───────────────────────────────────────────────────────

  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-1.5-pro',
    model_name: 'Gemini 1.5 Pro',
    family: 'Gemini-1.5',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'vision', 'agent_planning', 'multilingual', 'creative'],
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
    supports_video_planning: true,
    supports_agent_planning: true,
    context_window: 1_000_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: true,
    specialist_domains: ['long-context', 'multimodal', 'planning', 'analysis', 'travel'],
  },
  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-1.5-flash',
    model_name: 'Gemini 1.5 Flash',
    family: 'Gemini-1.5',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'vision', 'multilingual', 'creative'],
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
    context_window: 1_000_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['chat', 'multimodal', 'quick-tasks', 'marketing'],
  },
  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-2.0-flash',
    model_name: 'Gemini 2.0 Flash',
    family: 'Gemini-2.0',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'vision', 'multilingual'],
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
    supports_video_planning: true,
    supports_agent_planning: false,
    context_window: 1_000_000,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['chat', 'multimodal', 'real-time', 'general', 'video_planning'],
  },

  // ── Groq — expanded ───────────────────────────────────────────────────────

  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'llama-3.1-8b-instant',
    model_name: 'Llama 3.1 8B Instant (Groq)',
    family: 'Llama-3.1',
    primary_role: 'chat',
    secondary_roles: ['coding', 'multilingual'],
    supports_chat: true,
    supports_reasoning: false,
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
    context_window: 131_072,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['chat', 'quick-tasks', 'real-time', 'lightweight'],
  },
  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'gemma2-9b-it',
    model_name: 'Gemma 2 9B IT (Groq)',
    family: 'Gemma-2',
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
    context_window: 8_192,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 6,
    validator_eligible: false,
    specialist_domains: ['chat', 'multilingual', 'general'],
  },

  // ── DeepSeek — coding specialist ──────────────────────────────────────────

  {
    provider: 'deepseek',
    provider_tier: 'backbone',
    model_id: 'deepseek-coder',
    model_name: 'DeepSeek Coder',
    family: 'DeepSeek-Coder',
    primary_role: 'coding',
    secondary_roles: ['validation'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 16_000,
    latency_tier: 'medium',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['coding', 'debugging', 'code-review'],
  },

  // ── OpenRouter — expanded curated models ──────────────────────────────────

  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'anthropic/claude-3.5-sonnet',
    model_name: 'Claude 3.5 Sonnet via OpenRouter',
    family: 'Claude-3.5',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'agent_planning', 'multilingual', 'validation'],
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
    context_window: 200_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'coding', 'marketing', 'analysis', 'security'],
  },
  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'anthropic/claude-3-haiku',
    model_name: 'Claude 3 Haiku via OpenRouter',
    family: 'Claude-3',
    primary_role: 'chat',
    secondary_roles: ['coding', 'multilingual', 'creative'],
    supports_chat: true,
    supports_reasoning: false,
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
    context_window: 200_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 4,
    validator_eligible: false,
    specialist_domains: ['chat', 'quick-tasks', 'multilingual', 'general'],
  },
  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'meta-llama/llama-3.1-405b-instruct',
    model_name: 'Llama 3.1 405B via OpenRouter',
    family: 'Llama-3.1',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'multilingual'],
    supports_chat: true,
    supports_reasoning: true,
    supports_code: true,
    supports_tool_use: true,
    supports_multilingual: true,
    supports_structured_output: false,
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
    fallback_priority: 5,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'general', 'planning'],
  },
  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'mistralai/mistral-large',
    model_name: 'Mistral Large via OpenRouter',
    family: 'Mistral',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'multilingual'],
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
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 5,
    validator_eligible: true,
    specialist_domains: ['coding', 'multilingual', 'reasoning', 'general'],
  },

  // ── Together AI — expanded curated models ─────────────────────────────────

  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'meta-llama/Llama-3-8b-chat-hf',
    model_name: 'Llama 3 8B Chat (Together)',
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
    latency_tier: 'low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 7,
    validator_eligible: false,
    specialist_domains: ['chat', 'lightweight', 'multilingual'],
  },
  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
    model_name: 'Mixtral 8x22B Instruct (Together)',
    family: 'Mixtral',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'multilingual', 'creative'],
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
    context_window: 65_536,
    latency_tier: 'medium',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 5,
    validator_eligible: false,
    specialist_domains: ['reasoning', 'coding', 'multilingual', 'general'],
  },
  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'togethercomputer/RedPajama-INCITE-7B-Instruct',
    model_name: 'RedPajama 7B Instruct (Together)',
    family: 'RedPajama',
    primary_role: 'chat',
    secondary_roles: ['multilingual'],
    supports_chat: true,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'ultra_low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 8,
    validator_eligible: false,
    specialist_domains: ['chat', 'lightweight', 'multilingual', 'general'],
  },

  // ── NVIDIA NIM — expanded ─────────────────────────────────────────────────

  {
    provider: 'nvidia',
    provider_tier: 'backbone',
    model_id: 'nvidia/llama-3.1-nemotron-nano-8b-instruct',
    model_name: 'Llama 3.1 Nemotron Nano 8B Instruct',
    family: 'Llama-3.1',
    primary_role: 'chat',
    secondary_roles: ['coding', 'validation'],
    supports_chat: true,
    supports_reasoning: false,
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
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 5,
    validator_eligible: false,
    specialist_domains: ['chat', 'quick-tasks', 'lightweight'],
  },

  // ── Hugging Face — expanded ────────────────────────────────────────────────

  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'microsoft/phi-3-mini-4k-instruct',
    model_name: 'Phi-3 Mini 4K Instruct',
    family: 'Phi-3',
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
    context_window: 4_096,
    latency_tier: 'ultra_low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 9,
    validator_eligible: false,
    specialist_domains: ['chat', 'lightweight', 'coding', 'edge'],
  },
  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'sentence-transformers/all-MiniLM-L6-v2',
    model_name: 'All-MiniLM-L6-v2 (Sentence Embeddings)',
    family: 'Sentence-Transformers',
    primary_role: 'embeddings',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: true,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'ultra_low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'semantic-search', 'rag'],
  },
  {
    provider: 'huggingface',
    provider_tier: 'retrieval',
    model_id: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    model_name: 'MS-MARCO MiniLM Reranker',
    family: 'Cross-Encoder',
    primary_role: 'reranking',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: true,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'reranking', 'rag'],
  },

  // ── OpenAI — latest generation ────────────────────────────────────────────

  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'gpt-4.1',
    model_name: 'GPT-4.1',
    family: 'GPT-4.1',
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
    context_window: 1_000_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['finance', 'crypto', 'marketing', 'general', 'analysis', 'coding'],
  },
  {
    provider: 'openai',
    provider_tier: 'premium',
    model_id: 'o4-mini',
    model_name: 'o4 Mini (Fast Reasoning)',
    family: 'o4',
    primary_role: 'reasoning',
    secondary_roles: ['coding', 'validation'],
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
    supports_video_planning: true,
    supports_agent_planning: true,
    context_window: 200_000,
    latency_tier: 'medium',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: true,
    specialist_domains: ['math', 'coding', 'reasoning', 'science', 'security', 'video_planning'],
  },

  // ── xAI / Grok — expanded ────────────────────────────────────────────────

  {
    provider: 'grok',
    provider_tier: 'premium',
    model_id: 'grok-3-beta',
    model_name: 'Grok 3 Beta',
    family: 'Grok-3',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'agent_planning', 'multilingual', 'vision'],
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
    context_window: 131_072,
    latency_tier: 'medium',
    cost_tier: 'premium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['crypto', 'real-time-data', 'analysis', 'reasoning', 'general'],
  },
  {
    provider: 'grok',
    provider_tier: 'premium',
    model_id: 'grok-3-mini-beta',
    model_name: 'Grok 3 Mini Beta',
    family: 'Grok-3',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'multilingual'],
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
    context_window: 131_072,
    latency_tier: 'low',
    cost_tier: 'medium',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 4,
    validator_eligible: false,
    specialist_domains: ['chat', 'quick-tasks', 'crypto', 'real-time-data'],
  },

  // ── Gemini — latest generation ────────────────────────────────────────────

  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-2.5-pro-preview-05-06',
    model_name: 'Gemini 2.5 Pro Preview',
    family: 'Gemini-2.5',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'vision', 'agent_planning', 'multilingual', 'creative'],
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
    supports_video_planning: true,
    supports_agent_planning: true,
    context_window: 1_000_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['long-context', 'multimodal', 'reasoning', 'planning', 'coding'],
  },
  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-2.5-flash-preview-05-20',
    model_name: 'Gemini 2.5 Flash Preview',
    family: 'Gemini-2.5',
    primary_role: 'chat',
    secondary_roles: ['reasoning', 'coding', 'vision', 'multilingual'],
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
    supports_video_planning: true,
    supports_agent_planning: false,
    context_window: 1_000_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['chat', 'multimodal', 'quick-tasks', 'real-time', 'video_planning'],
  },
  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'text-embedding-004',
    model_name: 'Gemini Text Embedding 004',
    family: 'Gemini-Embedding',
    primary_role: 'embeddings',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: true,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 2_048,
    latency_tier: 'low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'semantic-search', 'rag'],
  },

  // ── Groq — safety & expanded ──────────────────────────────────────────────

  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'llama-guard-3-8b',
    model_name: 'Llama Guard 3 8B (Groq)',
    family: 'Llama-Guard-3',
    primary_role: 'validation',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: true,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 8_192,
    latency_tier: 'ultra_low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['safety', 'guardrails', 'content-moderation'],
  },
  {
    provider: 'groq',
    provider_tier: 'backbone',
    model_id: 'deepseek-r1-distill-llama-70b',
    model_name: 'DeepSeek R1 Distill Llama 70B (Groq)',
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
    context_window: 128_000,
    latency_tier: 'ultra_low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 4,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'math', 'coding', 'science'],
  },

  // ── NVIDIA NIM — expanded ─────────────────────────────────────────────────

  {
    provider: 'nvidia',
    provider_tier: 'backbone',
    model_id: 'nvidia/nemotron-4-340b-instruct',
    model_name: 'Nemotron-4 340B Instruct',
    family: 'Nemotron-4',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'agent_planning', 'multilingual'],
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
    context_window: 4_096,
    latency_tier: 'high',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'enterprise', 'instruction-following'],
  },
  {
    provider: 'nvidia',
    provider_tier: 'retrieval',
    model_id: 'nvidia/nv-rerankqa-mistral-4b-v3',
    model_name: 'NV-RerankQA Mistral 4B v3',
    family: 'NV-Rerank',
    primary_role: 'reranking',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: true,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'reranking', 'rag'],
  },
  {
    provider: 'nvidia',
    provider_tier: 'backbone',
    model_id: 'nvidia/nv-embedqa-e5-v5',
    model_name: 'NV-EmbedQA E5 v5',
    family: 'NV-Embed',
    primary_role: 'embeddings',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: true,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['retrieval', 'semantic-search', 'rag', 'enterprise'],
  },

  // ── HuggingFace — expanded ────────────────────────────────────────────────

  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    model_name: 'Llama 3.1 70B Instruct',
    family: 'Llama-3.1',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'multilingual', 'creative'],
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
    fallback_priority: 5,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'general', 'open-source', 'multilingual'],
  },

  // ── DeepSeek — expanded ───────────────────────────────────────────────────

  {
    provider: 'deepseek',
    provider_tier: 'backbone',
    model_id: 'deepseek-chat-v3-0324',
    model_name: 'DeepSeek Chat V3 (March 2025)',
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
    supports_agent_planning: true,
    context_window: 128_000,
    latency_tier: 'medium',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: true,
    specialist_domains: ['coding', 'math', 'reasoning', 'general', 'multilingual'],
  },

  // ── OpenRouter — expanded ─────────────────────────────────────────────────

  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'anthropic/claude-sonnet-4',
    model_name: 'Claude Sonnet 4 via OpenRouter',
    family: 'Claude-4',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'creative', 'agent_planning', 'multilingual', 'validation'],
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
    context_window: 200_000,
    latency_tier: 'medium',
    cost_tier: 'high',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'coding', 'analysis', 'security', 'general'],
  },
  {
    provider: 'openrouter',
    provider_tier: 'backbone',
    model_id: 'google/gemma-2-27b-it',
    model_name: 'Gemma 2 27B IT via OpenRouter',
    family: 'Gemma-2',
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
    context_window: 8_192,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 7,
    validator_eligible: false,
    specialist_domains: ['chat', 'multilingual', 'general', 'open-source'],
  },

  // ── Together AI — expanded ────────────────────────────────────────────────

  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    model_name: 'Llama 3.1 70B Instruct Turbo (Together)',
    family: 'Llama-3.1',
    primary_role: 'reasoning',
    secondary_roles: ['chat', 'coding', 'multilingual', 'creative'],
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
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 4,
    validator_eligible: true,
    specialist_domains: ['reasoning', 'general', 'open-source', 'multilingual'],
  },
  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    model_name: 'Qwen 2.5 72B Instruct Turbo (Together)',
    family: 'Qwen-2.5',
    primary_role: 'multilingual',
    secondary_roles: ['reasoning', 'chat', 'coding', 'creative'],
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
    context_window: 32_768,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 5,
    validator_eligible: false,
    specialist_domains: ['multilingual', 'coding', 'reasoning', 'general', 'cjk'],
  },
  {
    provider: 'together',
    provider_tier: 'backbone',
    model_id: 'mistralai/Mistral-7B-Instruct-v0.3',
    model_name: 'Mistral 7B Instruct v0.3 (Together)',
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
    latency_tier: 'low',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 7,
    validator_eligible: false,
    specialist_domains: ['chat', 'code', 'multilingual', 'lightweight'],
  },

  // ── Image Generation Specialists ─────────────────────────────────────────

  {
    provider: 'together',
    provider_tier: 'multimodal',
    model_id: 'stabilityai/stable-diffusion-xl-base-1.0',
    model_name: 'Stable Diffusion XL (Together)',
    family: 'Stable Diffusion',
    primary_role: 'image_generation',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: true,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 77,
    latency_tier: 'medium',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 1,
    validator_eligible: false,
    specialist_domains: ['image_generation', 'art', 'creative'],
  },
  {
    provider: 'together',
    provider_tier: 'multimodal',
    model_id: 'black-forest-labs/FLUX.1-schnell',
    model_name: 'FLUX.1 Schnell (Together)',
    family: 'FLUX',
    primary_role: 'image_generation',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: true,
    supports_video_planning: false,
    supports_agent_planning: false,
    context_window: 77,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 2,
    validator_eligible: false,
    specialist_domains: ['image_generation', 'art', 'fast_generation'],
  },

  // ── Gemini Voice (Google Cloud Speech / TTS via Gemini) ──────────────────

  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-2.0-flash-live-001',
    model_name: 'Gemini 2.0 Flash Live (STT)',
    family: 'Gemini-2.0',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 1_000_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'multilingual'],
  },
  {
    provider: 'gemini',
    provider_tier: 'premium',
    model_id: 'gemini-2.5-flash-preview-tts',
    model_name: 'Gemini 2.5 Flash Preview (TTS)',
    family: 'Gemini-2.5',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 1_000_000,
    latency_tier: 'low',
    cost_tier: 'low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 3,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'multilingual'],
  },

  // ── HuggingFace Voice Fallback Models ───────────────────────────────────

  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'openai/whisper-large-v3',
    model_name: 'Whisper Large v3 (HuggingFace)',
    family: 'Whisper',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 25_000,
    latency_tier: 'medium',
    cost_tier: 'very_low',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 8,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'multilingual', 'fallback'],
  },
  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'facebook/mms-tts-eng',
    model_name: 'MMS TTS English (HuggingFace)',
    family: 'MMS',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'medium',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 8,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'english', 'fallback'],
  },
  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'openai/whisper-small',
    model_name: 'Whisper Small (HuggingFace)',
    family: 'Whisper',
    primary_role: 'voice_interaction',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: true,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_stt: true,
    supports_voice_interaction: true,
    supports_agent_planning: false,
    context_window: 25_000,
    latency_tier: 'low',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 9,
    validator_eligible: false,
    specialist_domains: ['voice', 'stt', 'transcription', 'multilingual', 'fallback', 'lightweight'],
  },
  {
    provider: 'huggingface',
    provider_tier: 'backbone',
    model_id: 'facebook/mms-tts-fra',
    model_name: 'MMS TTS French (HuggingFace)',
    family: 'MMS',
    primary_role: 'tts',
    secondary_roles: [],
    supports_chat: false,
    supports_reasoning: false,
    supports_code: false,
    supports_tool_use: false,
    supports_multilingual: false,
    supports_structured_output: false,
    supports_embeddings: false,
    supports_reranking: false,
    supports_vision: false,
    supports_image_generation: false,
    supports_video_planning: false,
    supports_tts: true,
    supports_agent_planning: false,
    context_window: 4_096,
    latency_tier: 'medium',
    cost_tier: 'free',
    enabled: true,
    health_status: 'configured',
    fallback_priority: 9,
    validator_eligible: false,
    specialist_domains: ['voice', 'tts', 'french', 'fallback'],
  },
] as const satisfies readonly ModelEntry[];

// ── Boolean capability keys (used for type-safe filtering) ──────────────

/** Keys of `ModelEntry` that hold boolean capability flags. */
type BooleanCapabilityKey = {
  [K in keyof ModelEntry]-?: NonNullable<ModelEntry[K]> extends boolean ? K : never;
}[keyof ModelEntry];

// ── Provider health cache ───────────────────────────────────────────────
//
// The static MODEL_REGISTRY marks every model as enabled/configured because
// these are *known* models. At runtime the provider health cache overlays
// truthful health information derived from the database and live health
// checks. When the cache is populated, helper functions like
// `getUsableModels()` and `getModelEffectiveHealth()` reflect real state.
// When the cache is empty (e.g. during tests or before first health check),
// all enabled models are assumed usable for backwards compatibility.
// ────────────────────────────────────────────────────────────────────────

/** Health status values that can be stored in the provider health cache. */
export type ProviderHealthStatus = ModelEntry['health_status'];

interface ProviderHealthEntry {
  status: ProviderHealthStatus;
  lastChecked: Date;
}

const providerHealthCache = new Map<string, ProviderHealthEntry>();

/**
 * Update the cached health state for a provider.
 *
 * Call this after running `runProviderHealthCheck()` or after querying
 * the `AiProvider` table so that model-selection helpers reflect real
 * provider health.
 */
export function setProviderHealth(
  providerKey: string,
  status: ProviderHealthStatus,
): void {
  providerHealthCache.set(providerKey, { status, lastChecked: new Date() });
}

/**
 * Retrieve the cached health status for a provider.
 *
 * Returns `'unconfigured'` when no health data has been recorded yet.
 */
export function getProviderHealth(providerKey: string): ProviderHealthStatus {
  return providerHealthCache.get(providerKey)?.status ?? 'unconfigured';
}

/** Returns the full provider health cache snapshot (for diagnostics / dashboards). */
export function getProviderHealthSnapshot(): ReadonlyMap<string, Readonly<ProviderHealthEntry>> {
  return providerHealthCache;
}

/** Clear all cached provider health data (useful in tests). */
export function clearProviderHealthCache(): void {
  providerHealthCache.clear();
}

/**
 * Whether a provider is usable for routing.
 *
 * A provider is usable when its health status is `healthy` or `configured`.
 * When the health cache is **empty** (no health data recorded yet) or a
 * provider has no entry in the cache, it is considered **unconfigured** and
 * therefore NOT usable.  This prevents false availability before the first
 * health-check run.
 */
export function isProviderUsable(providerKey: string): boolean {
  const status = getProviderHealth(providerKey);
  return status === 'healthy' || status === 'configured';
}

/**
 * Whether a provider is degraded.
 *
 * Degraded providers are **not** considered usable by `isProviderUsable()`
 * and are excluded from eligible models. However, the routing engine may
 * still include degraded providers at the end of the fallback list when
 * building fallback chains, giving them lower priority than healthy ones.
 */
export function isProviderDegraded(providerKey: string): boolean {
  return getProviderHealth(providerKey) === 'degraded';
}

/**
 * Returns the effective health status for a model, considering the
 * provider health cache.
 *
 * When the cache has no entry for the model's provider, returns
 * `'unconfigured'` so that unchecked providers are not silently
 * treated as healthy.
 */
export function getModelEffectiveHealth(model: ModelEntry): ProviderHealthStatus {
  return getProviderHealth(model.provider);
}

/**
 * Returns models that are registered as enabled **and** whose provider
 * is currently usable (healthy / configured).
 *
 * This is the health-aware replacement for `getEnabledModels()` and
 * should be preferred by the routing engine and orchestrator.
 */
export function getUsableModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.enabled && isProviderUsable(m.provider));
}

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
  gemini: 'gemini-1.5-flash',
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
