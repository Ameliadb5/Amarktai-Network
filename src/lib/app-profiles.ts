/**
 * @module app-profiles
 * @description App Profile Registry for the AmarktAI Network.
 *
 * Every connected app has a rich profile that drives routing, memory,
 * agent permissions, and escalation logic. The Brain Gateway and
 * Orchestrator read from this registry to make per-app decisions
 * instead of applying blanket defaults.
 *
 * Server-side only – no browser APIs or external imports.
 */

// ── Type definitions ────────────────────────────────────────────────────────

/** When to escalate a task to a premium provider. */
export interface EscalationRule {
  /** Task complexity levels that trigger escalation. */
  when_complexity: ('moderate' | 'complex')[];
  /** Task types that trigger escalation (partial match). */
  when_task_types: string[];
  /** Provider key to escalate to. */
  escalate_to_provider: string;
  /** Preferred model on the escalation provider. */
  escalate_to_model: string;
}

/** When validation (second-opinion) is required. */
export interface ValidatorRule {
  /** Task types that require validation (partial match). */
  when_task_types: string[];
  /** Minimum complexity level that triggers validation. */
  min_complexity: 'simple' | 'moderate' | 'complex';
  /** Model IDs eligible to act as validators. */
  validator_models: string[];
}

/** Full profile for an app connected to the AmarktAI Network. */
export interface AppProfile {
  /** Unique application identifier. */
  app_id: string;
  /** Human-readable application name. */
  app_name: string;
  /** Application type classification. */
  app_type: string;
  /** Primary domain / category for the app. */
  domain: string;

  // ── Routing ────────────────────────────────────────────────────────────

  /** Default routing mode when no override is specified. */
  default_routing_mode: 'direct' | 'specialist' | 'review' | 'consensus';

  /** Provider keys this app is allowed to use. */
  allowed_providers: string[];
  /** Model IDs this app is allowed to use. */
  allowed_models: string[];
  /** Preferred model IDs (ordered by priority, first = best). */
  preferred_models: string[];

  // ── Escalation & validation ────────────────────────────────────────────

  /** Rules governing premium escalation. */
  escalation_rules: EscalationRule[];
  /** Rules governing when validation is required. */
  validator_rules: ValidatorRule[];

  // ── Permissions ────────────────────────────────────────────────────────

  /** Permitted agent-level actions. */
  agent_permissions: string[];
  /** Permitted multimodal capabilities. */
  multimodal_permissions: string[];

  // ── Memory & retrieval ─────────────────────────────────────────────────

  /** Namespace used for the memory layer. */
  memory_namespace: string;
  /** Namespace used for retrieval / RAG operations. */
  retrieval_namespace: string;

  // ── Operational ────────────────────────────────────────────────────────

  /** Budget sensitivity classification. */
  budget_sensitivity: 'low' | 'medium' | 'high';
  /** Latency sensitivity classification. */
  latency_sensitivity: 'low' | 'medium' | 'high';
  /** Privacy rules applied to logging for this app. */
  logging_privacy_rules: string[];

  // ── Safety ──────────────────────────────────────────────────────────────

  /** When true, all content passes through strict safety filters (default: true). */
  safe_mode?: boolean;
  /** When true, non-harmful adult content is allowed. Requires safe_mode=false and explicit opt-in. */
  adult_mode?: boolean;

  // ── Budget ──────────────────────────────────────────────────────────────

  /** Per-app monthly budget cap in USD (optional). */
  monthly_budget_usd?: number;

  // ── AI Capabilities ─────────────────────────────────────────────────────

  /** AI capabilities enabled for this app. */
  enabled_capabilities?: string[];
}

// ── Shared constants ────────────────────────────────────────────────────────

const ALL_PROVIDERS = [
  'openai', 'grok', 'nvidia', 'huggingface', 'deepseek', 'groq', 'openrouter', 'together',
];

const BACKBONE_PROVIDERS = [
  'nvidia', 'huggingface', 'deepseek', 'groq', 'openrouter', 'together',
];

const BASIC_AGENT_PERMISSIONS = [
  'chat', 'summarise', 'translate',
  'agent:planner', 'agent:router', 'agent:memory',
];
const FULL_AGENT_PERMISSIONS = [
  'chat', 'summarise', 'translate', 'tool_use', 'agent_planning', 'code_generation',
  'agent:planner', 'agent:router', 'agent:validator', 'agent:memory', 'agent:retrieval',
  'agent:creative', 'agent:campaign', 'agent:trading_analyst', 'agent:app_ops', 'agent:learning',
  'agent:security', 'agent:voice', 'agent:travel_planner', 'agent:developer',
  'agent:support_community', 'agent:healing',
];

const BASIC_PRIVACY_RULES = ['mask_pii', 'no_raw_credentials'];
const STRICT_PRIVACY_RULES = ['mask_pii', 'no_raw_credentials', 'redact_financial_data', 'audit_log_required'];

// ── Default profile (fallback for unknown apps) ─────────────────────────────

export const DEFAULT_PROFILE: AppProfile = {
  app_id: 'unknown',
  app_name: 'Unknown App',
  app_type: 'general',
  domain: 'general',

  default_routing_mode: 'direct',

  allowed_providers: BACKBONE_PROVIDERS,
  allowed_models: [
    'llama-3.3-70b-versatile',
    'deepseek-chat',
    'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ],
  preferred_models: ['llama-3.3-70b-versatile', 'deepseek-chat'],

  escalation_rules: [],
  validator_rules: [],

  agent_permissions: BASIC_AGENT_PERMISSIONS,
  multimodal_permissions: [],

  memory_namespace: 'default',
  retrieval_namespace: 'default',

  budget_sensitivity: 'high',
  latency_sensitivity: 'medium',
  logging_privacy_rules: BASIC_PRIVACY_RULES,
};

// ── Per-app profiles ────────────────────────────────────────────────────────

export const DEFAULT_APP_PROFILES: ReadonlyMap<string, AppProfile> = new Map<string, AppProfile>([

  // ── Amarktai Network (platform admin) ──────────────────────────────────

  ['amarktai-network', {
    app_id: 'amarktai-network',
    app_name: 'Amarktai Network',
    app_type: 'platform',
    domain: 'admin',

    default_routing_mode: 'specialist',

    allowed_providers: ALL_PROVIDERS,
    allowed_models: [
      'gpt-4o', 'gpt-4o-mini', 'grok-3-mini-beta',
      'llama-3.3-70b-versatile', 'deepseek-chat', 'deepseek-reasoner',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    preferred_models: ['gpt-4o', 'deepseek-reasoner', 'llama-3.3-70b-versatile'],

    escalation_rules: [{
      when_complexity: ['complex'],
      when_task_types: ['audit', 'decision', 'report', 'system'],
      escalate_to_provider: 'openai',
      escalate_to_model: 'gpt-4o',
    }],
    validator_rules: [{
      when_task_types: ['audit', 'decision', 'system', 'configuration'],
      min_complexity: 'complex',
      validator_models: ['deepseek-reasoner', 'grok-3-mini-beta'],
    }],

    agent_permissions: FULL_AGENT_PERMISSIONS,
    multimodal_permissions: ['vision'],

    memory_namespace: 'amarktai-network',
    retrieval_namespace: 'amarktai-network',

    budget_sensitivity: 'medium',
    latency_sensitivity: 'medium',
    logging_privacy_rules: STRICT_PRIVACY_RULES,
  }],

  // ── Amarktai Crypto (trading / finance) ────────────────────────────────

  ['amarktai-crypto', {
    app_id: 'amarktai-crypto',
    app_name: 'Amarktai Crypto',
    app_type: 'specialist',
    domain: 'crypto',

    default_routing_mode: 'review',

    allowed_providers: ALL_PROVIDERS,
    allowed_models: [
      'gpt-4o', 'gpt-4o-mini', 'grok-3-mini-beta',
      'deepseek-chat', 'deepseek-reasoner',
      'llama-3.3-70b-versatile',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    preferred_models: ['gpt-4o', 'deepseek-reasoner', 'grok-3-mini-beta'],

    escalation_rules: [
      {
        when_complexity: ['moderate', 'complex'],
        when_task_types: ['analysis', 'forecast', 'strategy', 'trading', 'recommendation'],
        escalate_to_provider: 'openai',
        escalate_to_model: 'gpt-4o',
      },
      {
        when_complexity: ['complex'],
        when_task_types: ['audit', 'decision', 'report'],
        escalate_to_provider: 'grok',
        escalate_to_model: 'grok-3-mini-beta',
      },
    ],
    validator_rules: [
      {
        when_task_types: ['analysis', 'forecast', 'strategy', 'trading', 'recommendation', 'audit'],
        min_complexity: 'moderate',
        validator_models: ['deepseek-reasoner', 'gpt-4o', 'grok-3-mini-beta'],
      },
      {
        when_task_types: ['decision', 'report'],
        min_complexity: 'complex',
        validator_models: ['gpt-4o', 'deepseek-reasoner'],
      },
    ],

    agent_permissions: [...FULL_AGENT_PERMISSIONS, 'data_retrieval'],
    multimodal_permissions: [],

    memory_namespace: 'amarktai-crypto',
    retrieval_namespace: 'amarktai-crypto',

    budget_sensitivity: 'low',
    latency_sensitivity: 'medium',
    logging_privacy_rules: [...STRICT_PRIVACY_RULES, 'log_all_decisions', 'retain_audit_trail'],
  }],

  // ── Amarktai Marketing (creative / content) ────────────────────────────

  ['amarktai-marketing', {
    app_id: 'amarktai-marketing',
    app_name: 'Amarktai Marketing',
    app_type: 'creative',
    domain: 'marketing',

    default_routing_mode: 'specialist',

    allowed_providers: ALL_PROVIDERS,
    allowed_models: [
      'gpt-4o', 'gpt-4o-mini', 'grok-3-mini-beta',
      'llama-3.3-70b-versatile', 'deepseek-chat',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    preferred_models: ['gpt-4o', 'llama-3.3-70b-versatile', 'grok-3-mini-beta'],

    escalation_rules: [{
      when_complexity: ['complex'],
      when_task_types: ['strategy', 'campaign', 'brand', 'report'],
      escalate_to_provider: 'openai',
      escalate_to_model: 'gpt-4o',
    }],
    validator_rules: [{
      when_task_types: ['strategy', 'campaign', 'brand'],
      min_complexity: 'complex',
      validator_models: ['deepseek-chat', 'gpt-4o-mini'],
    }],

    agent_permissions: [...BASIC_AGENT_PERMISSIONS, 'tool_use', 'code_generation'],
    multimodal_permissions: ['vision', 'image_generation'],

    memory_namespace: 'amarktai-marketing',
    retrieval_namespace: 'amarktai-marketing',

    budget_sensitivity: 'medium',
    latency_sensitivity: 'low',
    logging_privacy_rules: BASIC_PRIVACY_RULES,
  }],

  // ── Amarktai Travel ────────────────────────────────────────────────────

  ['amarktai-travel', {
    app_id: 'amarktai-travel',
    app_name: 'Amarktai Travel',
    app_type: 'general',
    domain: 'travel',

    default_routing_mode: 'specialist',

    allowed_providers: [...BACKBONE_PROVIDERS, 'openai'],
    allowed_models: [
      'gpt-4o-mini',
      'llama-3.3-70b-versatile', 'deepseek-chat',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    preferred_models: ['llama-3.3-70b-versatile', 'deepseek-chat', 'gpt-4o-mini'],

    escalation_rules: [{
      when_complexity: ['complex'],
      when_task_types: ['itinerary', 'recommendation', 'analysis', 'booking'],
      escalate_to_provider: 'openai',
      escalate_to_model: 'gpt-4o-mini',
    }],
    validator_rules: [{
      when_task_types: ['itinerary', 'booking', 'recommendation'],
      min_complexity: 'complex',
      validator_models: ['deepseek-chat', 'gpt-4o-mini'],
    }],

    agent_permissions: [...BASIC_AGENT_PERMISSIONS, 'tool_use'],
    multimodal_permissions: ['vision'],

    memory_namespace: 'amarktai-travel',
    retrieval_namespace: 'amarktai-travel',

    budget_sensitivity: 'high',
    latency_sensitivity: 'medium',
    logging_privacy_rules: BASIC_PRIVACY_RULES,
  }],

  // ── EquiProfile (equine specialist) ────────────────────────────────────

  ['equiprofile', {
    app_id: 'equiprofile',
    app_name: 'EquiProfile',
    app_type: 'specialist',
    domain: 'equine',

    default_routing_mode: 'specialist',

    allowed_providers: BACKBONE_PROVIDERS,
    allowed_models: [
      'llama-3.3-70b-versatile', 'deepseek-chat',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    preferred_models: ['llama-3.3-70b-versatile', 'deepseek-chat'],

    escalation_rules: [{
      when_complexity: ['complex'],
      when_task_types: ['health', 'diagnosis', 'recommendation', 'report'],
      escalate_to_provider: 'groq',
      escalate_to_model: 'llama-3.3-70b-versatile',
    }],
    validator_rules: [{
      when_task_types: ['health', 'diagnosis'],
      min_complexity: 'moderate',
      validator_models: ['deepseek-chat', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    }],

    agent_permissions: BASIC_AGENT_PERMISSIONS,
    multimodal_permissions: ['vision'],

    memory_namespace: 'equiprofile',
    retrieval_namespace: 'equiprofile',

    budget_sensitivity: 'high',
    latency_sensitivity: 'medium',
    logging_privacy_rules: BASIC_PRIVACY_RULES,
  }],

  // ── Amarktai Online (general purpose) ──────────────────────────────────

  ['amarktai-online', {
    app_id: 'amarktai-online',
    app_name: 'Amarktai Online',
    app_type: 'general',
    domain: 'general',

    default_routing_mode: 'direct',

    allowed_providers: BACKBONE_PROVIDERS,
    allowed_models: [
      'llama-3.3-70b-versatile', 'deepseek-chat',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    preferred_models: ['llama-3.3-70b-versatile', 'deepseek-chat'],

    escalation_rules: [],
    validator_rules: [{
      when_task_types: ['analysis', 'report'],
      min_complexity: 'complex',
      validator_models: ['deepseek-chat'],
    }],

    agent_permissions: BASIC_AGENT_PERMISSIONS,
    multimodal_permissions: [],

    memory_namespace: 'amarktai-online',
    retrieval_namespace: 'amarktai-online',

    budget_sensitivity: 'high',
    latency_sensitivity: 'high',
    logging_privacy_rules: BASIC_PRIVACY_RULES,
  }],
]);

// ── Helper functions ────────────────────────────────────────────────────────

const COMPLEXITY_ORDER: Record<string, number> = { simple: 0, moderate: 1, complex: 2 };

/**
 * Runtime profile overrides — set via the admin API.
 * These take precedence over DEFAULT_APP_PROFILES.
 * Stored in-memory (persists for the server process lifetime).
 */
export const runtimeProfileOverrides = new Map<string, AppProfile>();

/**
 * Get the app profile for a given slug. Falls back to `DEFAULT_PROFILE`
 * when the slug is not in the registry.
 */
export function getAppProfile(appSlug: string): AppProfile {
  const key = (appSlug ?? '').toLowerCase().trim();
  return runtimeProfileOverrides.get(key) ?? DEFAULT_APP_PROFILES.get(key) ?? DEFAULT_PROFILE;
}

/** Check whether a provider key is allowed for the given profile. */
export function isProviderAllowed(profile: AppProfile, providerKey: string): boolean {
  return profile.allowed_providers.includes(providerKey);
}

/** Check whether a model ID is in the profile's allowed list. */
export function isModelAllowed(profile: AppProfile, modelId: string): boolean {
  return profile.allowed_models.includes(modelId);
}

/** Get the ordered list of preferred models for the given profile. */
export function getPreferredModels(profile: AppProfile): string[] {
  return profile.preferred_models;
}

/**
 * Determine whether the task should escalate to a premium provider.
 *
 * Returns the matching `EscalationRule` if escalation is warranted,
 * or `null` if no rule matches.
 */
export function shouldEscalate(
  profile: AppProfile,
  taskComplexity: string,
  taskType: string,
): EscalationRule | null {
  const task = (taskType ?? '').toLowerCase();
  const complexity = (taskComplexity ?? '').toLowerCase();

  for (const rule of profile.escalation_rules) {
    const complexityMatch = rule.when_complexity.some(
      (c) => c === complexity,
    );
    const taskMatch = rule.when_task_types.some(
      (t) => task.includes(t),
    );
    if (complexityMatch && taskMatch) return rule;
  }

  return null;
}

/**
 * Check whether validation is required for the given task.
 *
 * Returns the matching `ValidatorRule` if validation is needed,
 * or `null` otherwise. Both the task type and complexity must
 * satisfy the rule for it to match.
 */
export function requiresValidation(
  profile: AppProfile,
  taskType: string,
  taskComplexity: string = 'moderate',
): ValidatorRule | null {
  const task = (taskType ?? '').toLowerCase();
  const complexityLevel = COMPLEXITY_ORDER[taskComplexity] ?? 1;

  for (const rule of profile.validator_rules) {
    const minLevel = COMPLEXITY_ORDER[rule.min_complexity] ?? 1;
    if (complexityLevel < minLevel) continue;

    const taskMatch = rule.when_task_types.some(
      (t) => task.includes(t),
    );
    if (taskMatch) return rule;
  }

  return null;
}

/** Get the memory namespace for an app profile. */
export function getMemoryNamespace(profile: AppProfile): string {
  return profile.memory_namespace;
}

/** Get the retrieval namespace for an app profile. */
export function getRetrievalNamespace(profile: AppProfile): string {
  return profile.retrieval_namespace;
}
