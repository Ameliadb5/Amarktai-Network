/**
 * Amarktai Network — Canonical Provider Catalog
 *
 * Single source of truth for every AI provider the platform recognises.
 * Import this module whenever you need provider identity metadata such as
 * display names, default base URLs, capability families, or health-check
 * eligibility.
 *
 * Server-side only — this file MUST NOT be imported from client components.
 */

/**
 * Shape of a single entry in the canonical provider catalog.
 */
export interface CanonicalProviderEntry {
  /** Unique lowercase identifier used as the storage / routing key. */
  readonly key: string;
  /** Human-friendly label shown in the UI. */
  readonly displayName: string;
  /** Default API base URL (no trailing slash). */
  readonly defaultBaseUrl: string;
  /** Whether a lightweight health-check ping is supported without special access. */
  readonly healthCheckSupported: boolean;
  /** Capability families this provider is known to cover. */
  readonly supportedCapabilityFamilies: readonly string[];
  /** Deterministic display ordering (lower = higher priority). */
  readonly sortOrder: number;
  /**
   * Whether this provider must be configured for the platform to go live.
   * Errors on required providers are shown as blocking; errors on optional
   * providers are shown as degraded warnings and do not affect the system
   * health score denominator.
   */
  readonly launchRequired: boolean;
}

/**
 * Authoritative, ordered list of every canonical provider.
 *
 * Add new providers here — every other subsystem should derive its
 * provider list from this array.
 */
export const CANONICAL_PROVIDERS: readonly CanonicalProviderEntry[] = [
  {
    key: 'openai',
    displayName: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: [
      'chat',
      'reasoning',
      'code',
      'vision',
      'image_generation',
      'embeddings',
      'tts',
      'voice_interaction',
      'agent_planning',
    ],
    sortOrder: 0,
    launchRequired: true,
  },
  {
    key: 'groq',
    displayName: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code'],
    sortOrder: 1,
    launchRequired: false,
  },
  {
    key: 'grok',
    displayName: 'Grok / xAI',
    defaultBaseUrl: 'https://api.x.ai',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code', 'vision'],
    sortOrder: 2,
    launchRequired: false,
  },
  {
    key: 'deepseek',
    displayName: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code'],
    sortOrder: 3,
    launchRequired: false,
  },
  {
    key: 'gemini',
    displayName: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code', 'vision'],
    sortOrder: 4,
    launchRequired: false,
  },
  {
    key: 'huggingface',
    displayName: 'Hugging Face',
    defaultBaseUrl: 'https://api-inference.huggingface.co',
    healthCheckSupported: true,
    supportedCapabilityFamilies: [
      'chat',
      'embeddings',
      'image_generation',
      'reranking',
      'tts',
      'voice_interaction',
    ],
    sortOrder: 5,
    launchRequired: false,
  },
  {
    key: 'nvidia',
    displayName: 'NVIDIA',
    defaultBaseUrl: 'https://integrate.api.nvidia.com',
    healthCheckSupported: false,
    supportedCapabilityFamilies: ['chat', 'embeddings', 'reranking'],
    sortOrder: 6,
    launchRequired: false,
  },
  {
    key: 'openrouter',
    displayName: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api',
    healthCheckSupported: true,
    supportedCapabilityFamilies: [
      'chat',
      'reasoning',
      'code',
      'image_generation',
    ],
    sortOrder: 7,
    launchRequired: false,
  },
  {
    key: 'together',
    displayName: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'code', 'image_generation'],
    sortOrder: 8,
    launchRequired: false,
  },
  {
    key: 'qwen',
    displayName: 'Qwen',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code', 'vision', 'image_generation', 'video_generation', 'embeddings', 'voice_interaction'],
    sortOrder: 9,
    launchRequired: false,
  },
  {
    key: 'replicate',
    displayName: 'Replicate',
    defaultBaseUrl: 'https://api.replicate.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['video_generation', 'image_generation'],
    sortOrder: 10,
    launchRequired: false,
  },
  {
    key: 'anthropic',
    displayName: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code', 'vision', 'agent_planning'],
    sortOrder: 11,
    launchRequired: false,
  },
  {
    key: 'cohere',
    displayName: 'Cohere',
    defaultBaseUrl: 'https://api.cohere.com',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'embeddings', 'reranking'],
    sortOrder: 12,
    launchRequired: false,
  },
  {
    key: 'mistral',
    displayName: 'Mistral AI',
    defaultBaseUrl: 'https://api.mistral.ai',
    healthCheckSupported: true,
    supportedCapabilityFamilies: ['chat', 'reasoning', 'code'],
    sortOrder: 13,
    launchRequired: false,
  },
] as const;

/**
 * Look up a single canonical provider by its unique key.
 *
 * @param key - Provider key, e.g. `'openai'` or `'groq'`.
 * @returns The matching {@link CanonicalProviderEntry}, or `undefined` if
 *          the key is not recognised.
 */
export function getCanonicalProvider(
  key: string,
): CanonicalProviderEntry | undefined {
  return CANONICAL_PROVIDERS.find((p) => p.key === key);
}

/**
 * Return every recognised provider key in catalog order.
 */
export function getCanonicalProviderKeys(): string[] {
  return CANONICAL_PROVIDERS.map((p) => p.key);
}
