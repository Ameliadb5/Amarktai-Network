/**
 * @module capability-packs
 * @description Capability Pack system for the AmarktAI Network platform.
 *
 * Each Capability Pack defines a curated bundle of AI capabilities, provider
 * access, agent assignments, and safety/budget constraints tailored to a
 * specific category of application (support bots, creator tools, companion
 * apps, etc.).  Apps register against a pack to receive a pre-configured
 * slice of the AmarktAI brain that matches their use-case.
 *
 * Server-side only — do NOT import from client components.
 */

// ── Types ────────────────────────────────────────────────

/** Budget limits expressed in USD cents. */
export interface PackBudget {
  /** Maximum spend per calendar day (USD cents). */
  daily: number
  /** Maximum spend per calendar month (USD cents). */
  monthly: number
}

/** A curated bundle of AI capabilities for a category of application. */
export interface CapabilityPack {
  /** Unique pack identifier (e.g. 'support_pack'). */
  id: string
  /** Human-readable pack name. */
  name: string
  /** Short description of the pack's purpose. */
  description: string
  /** AI capabilities included in this pack (e.g. 'chat', 'voice'). */
  capabilities: string[]
  /** Provider slugs the pack is allowed to call. */
  allowedProviders: string[]
  /** Model identifiers recommended for this pack. */
  recommendedModels: string[]
  /** Content-safety tier for the pack. */
  safetyLevel: 'strict' | 'standard' | 'relaxed' | 'adult_gated'
  /** Default spend limits in USD cents. */
  defaultBudget: PackBudget
  /** Agent types recommended for orchestration. */
  recommendedAgents: string[]
  /** How much conversation history the pack retains. */
  memoryStrategy: 'full' | 'session' | 'minimal' | 'none'
  /** Whether the pack requires a real-time streaming connection. */
  realtimeRequired: boolean
  /** Searchable tags for discovery. */
  tags: string[]
}

/** Result of a pack safety validation check. */
export interface PackSafetyResult {
  /** Whether the pack is safe to use with the given app flags. */
  valid: boolean
  /** Human-readable reason when validation fails. */
  reason?: string
}

/** Flags describing the target application's audience. */
export interface AppSafetyFlags {
  /** App serves adult-only (18+) content. */
  isAdult?: boolean
  /** App is intended for or accessible to minors. */
  isMinorFacing?: boolean
}

// ── Pack Definitions ─────────────────────────────────────

const CAPABILITY_PACKS: Map<string, CapabilityPack> = new Map([
  [
    'support_pack',
    {
      id: 'support_pack',
      name: 'Support & Chat Pack',
      description:
        'Customer support and help-desk chat applications with retrieval-augmented generation and voice.',
      capabilities: ['chat', 'retrieval', 'agents', 'voice', 'structured_output'],
      allowedProviders: ['openai', 'groq', 'deepseek'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 5_000, monthly: 100_000 }, // $50/day, $1 000/month
      recommendedAgents: ['router', 'support_community', 'memory'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['support', 'chat', 'helpdesk', 'customer-service'],
    },
  ],
  [
    'creator_pack',
    {
      id: 'creator_pack',
      name: 'Creator & Marketing Pack',
      description:
        'Creative and marketing applications including image/video generation, copywriting, and campaign management.',
      capabilities: ['chat', 'image_generation', 'video', 'voice', 'code', 'reasoning'],
      allowedProviders: ['openai', 'deepseek', 'together'],
      recommendedModels: ['gpt-4o', 'deepseek-r1'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 8_000, monthly: 200_000 }, // $80/day, $2 000/month
      recommendedAgents: ['creative', 'campaign', 'router'],
      memoryStrategy: 'session',
      realtimeRequired: false,
      tags: ['creator', 'marketing', 'content', 'creative'],
    },
  ],
  [
    'companion_pack',
    {
      id: 'companion_pack',
      name: 'AI Companion Pack',
      description:
        'Persistent AI companion applications with rich memory, voice interaction, and image capabilities.',
      capabilities: ['chat', 'voice', 'image_generation', 'reasoning', 'embeddings'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 10_000, monthly: 250_000 }, // $100/day, $2 500/month
      recommendedAgents: ['router', 'memory', 'creative'],
      memoryStrategy: 'full',
      realtimeRequired: true,
      tags: ['companion', 'social', 'conversational', 'ai-friend'],
    },
  ],
  [
    'knowledge_pack',
    {
      id: 'knowledge_pack',
      name: 'Knowledge & Education Pack',
      description:
        'Religious texts, educational content, and knowledge-base applications with deep retrieval and multilingual support.',
      capabilities: [
        'chat',
        'retrieval',
        'reasoning',
        'structured_output',
        'embeddings',
        'multilingual',
      ],
      allowedProviders: ['openai', 'deepseek', 'groq'],
      recommendedModels: ['gpt-4o', 'deepseek-r1'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 3_000, monthly: 80_000 }, // $30/day, $800/month
      recommendedAgents: ['router', 'retrieval', 'memory'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['knowledge', 'education', 'religious', 'reference', 'multilingual'],
    },
  ],
  [
    'dating_pack',
    {
      id: 'dating_pack',
      name: 'Dating & Social Pack',
      description:
        'Dating and social-matching applications with conversational AI, image generation, and real-time voice.',
      capabilities: ['chat', 'image_generation', 'voice', 'reasoning'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 7_000, monthly: 150_000 }, // $70/day, $1 500/month
      recommendedAgents: ['router', 'memory', 'creative'],
      memoryStrategy: 'session',
      realtimeRequired: true,
      tags: ['dating', 'social', 'matchmaking', 'relationships'],
    },
  ],
  [
    'media_pack',
    {
      id: 'media_pack',
      name: 'Music & Media Pack',
      description:
        'Music production, media generation, and creative asset pipelines with image, video, and code capabilities.',
      capabilities: ['chat', 'image_generation', 'video', 'voice', 'code'],
      allowedProviders: ['openai', 'together', 'deepseek'],
      recommendedModels: ['gpt-4o', 'deepseek-r1'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 12_000, monthly: 300_000 }, // $120/day, $3 000/month
      recommendedAgents: ['creative', 'router'],
      memoryStrategy: 'minimal',
      realtimeRequired: false,
      tags: ['music', 'media', 'audio', 'video', 'production'],
    },
  ],
  [
    'voice_pack',
    {
      id: 'voice_pack',
      name: 'Voice Companion Pack',
      description:
        'Voice-first companion and assistant applications with persistent memory and real-time streaming.',
      capabilities: ['chat', 'voice', 'reasoning'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 6_000, monthly: 150_000 }, // $60/day, $1 500/month
      recommendedAgents: ['router', 'voice', 'memory'],
      memoryStrategy: 'full',
      realtimeRequired: true,
      tags: ['voice', 'assistant', 'companion', 'realtime'],
    },
  ],
  [
    'dev_pack',
    {
      id: 'dev_pack',
      name: 'Developer Tools Pack',
      description:
        'Developer-oriented tools with code generation, reasoning, structured output, and agentic planning.',
      capabilities: ['chat', 'code', 'reasoning', 'structured_output', 'tool_use', 'agent_planning'],
      allowedProviders: ['openai', 'deepseek', 'groq', 'together'],
      recommendedModels: ['gpt-4o', 'deepseek-r1'],
      safetyLevel: 'relaxed',
      defaultBudget: { daily: 15_000, monthly: 400_000 }, // $150/day, $4 000/month
      recommendedAgents: ['developer', 'router', 'planner'],
      memoryStrategy: 'session',
      realtimeRequired: false,
      tags: ['developer', 'coding', 'tools', 'engineering', 'devtools'],
    },
  ],
  [
    'adult_18plus_pack',
    {
      id: 'adult_18plus_pack',
      name: 'Adult (18+) Pack',
      description:
        'Age-gated adult content applications requiring verified 18+ audiences and strict access controls.',
      capabilities: ['chat', 'image_generation', 'voice', 'video'],
      allowedProviders: ['openai', 'together'],
      recommendedModels: ['gpt-4o'],
      safetyLevel: 'adult_gated',
      defaultBudget: { daily: 10_000, monthly: 250_000 }, // $100/day, $2 500/month
      recommendedAgents: ['router', 'creative', 'memory'],
      memoryStrategy: 'session',
      realtimeRequired: false,
      tags: ['18+', 'age-verified', 'gated', 'adult'],
    },
  ],
  [
    'research_pack',
    {
      id: 'research_pack',
      name: 'Research & Analysis Pack',
      description:
        'Deep research, web scraping, data analysis, and report generation for intelligence-gathering applications.',
      capabilities: ['chat', 'retrieval', 'reasoning', 'structured_output', 'embeddings', 'code'],
      allowedProviders: ['openai', 'deepseek', 'groq', 'together'],
      recommendedModels: ['gpt-4o', 'deepseek-r1'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 10_000, monthly: 250_000 },
      recommendedAgents: ['researcher', 'retrieval', 'router'],
      memoryStrategy: 'session',
      realtimeRequired: false,
      tags: ['research', 'analysis', 'intelligence', 'scraping', 'data'],
    },
  ],
  [
    'security_pack',
    {
      id: 'security_pack',
      name: 'Security & Monitoring Pack',
      description:
        'Security monitoring, threat analysis, anomaly detection, and compliance reporting applications.',
      capabilities: ['chat', 'reasoning', 'structured_output', 'code'],
      allowedProviders: ['openai', 'deepseek'],
      recommendedModels: ['gpt-4o', 'deepseek-r1'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 5_000, monthly: 120_000 },
      recommendedAgents: ['security', 'router', 'planner'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['security', 'monitoring', 'compliance', 'threat', 'audit'],
    },
  ],
  [
    'operations_pack',
    {
      id: 'operations_pack',
      name: 'Operations & Automation Pack',
      description:
        'Business operations automation, scheduling, notifications, and workflow orchestration.',
      capabilities: ['chat', 'reasoning', 'structured_output', 'tool_use', 'agent_planning'],
      allowedProviders: ['openai', 'groq', 'deepseek'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 8_000, monthly: 200_000 },
      recommendedAgents: ['operations', 'router', 'planner'],
      memoryStrategy: 'session',
      realtimeRequired: false,
      tags: ['operations', 'automation', 'workflow', 'scheduling', 'notifications'],
    },
  ],
  [
    'pet_horse_pack',
    {
      id: 'pet_horse_pack',
      name: 'Pet & Equestrian Pack',
      description:
        'Pet care, equestrian, and animal-focused applications with image recognition and advice generation.',
      capabilities: ['chat', 'image_generation', 'reasoning', 'retrieval'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 5_000, monthly: 100_000 },
      recommendedAgents: ['router', 'memory', 'creative'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['pet', 'horse', 'equestrian', 'animal', 'veterinary'],
    },
  ],
  [
    'religious_pack',
    {
      id: 'religious_pack',
      name: 'Religious & Spiritual Pack',
      description:
        'Faith-based applications — Bible study, sermon prep, prayer tools, devotional content, and doctrinal research.',
      capabilities: ['chat', 'reasoning', 'retrieval', 'structured_output'],
      allowedProviders: ['openai', 'groq', 'deepseek'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 5_000, monthly: 80_000 },
      recommendedAgents: ['router', 'memory', 'validator'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['religious', 'faith', 'bible', 'church', 'spiritual', 'devotional', 'prayer'],
    },
  ],
  [
    'education_pack',
    {
      id: 'education_pack',
      name: 'Education & Learning Pack',
      description:
        'Educational platforms — tutoring, quiz generation, course content, study aids, and adaptive learning.',
      capabilities: ['chat', 'reasoning', 'retrieval', 'embeddings', 'structured_output'],
      allowedProviders: ['openai', 'groq', 'deepseek'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 8_000, monthly: 150_000 },
      recommendedAgents: ['router', 'memory', 'learning'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['education', 'learning', 'tutoring', 'study', 'school', 'course', 'quiz'],
    },
  ],
  [
    'smart_home_pack',
    {
      id: 'smart_home_pack',
      name: 'Smart Home Pack',
      description:
        'Home automation and IoT control — device management, routines, energy monitoring, and voice commands.',
      capabilities: ['chat', 'voice', 'structured_output', 'agents'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o-mini', 'llama-3.1-8b'],
      safetyLevel: 'standard',
      defaultBudget: { daily: 3_000, monthly: 60_000 },
      recommendedAgents: ['router', 'executor'],
      memoryStrategy: 'session',
      realtimeRequired: true,
      tags: ['smart_home', 'iot', 'automation', 'home', 'device', 'energy'],
    },
  ],
  [
    'health_pack',
    {
      id: 'health_pack',
      name: 'Health & Tracking Pack',
      description:
        'Health and wellness applications — fitness tracking, nutrition, mental health, symptom logging, and wellness coaching.',
      capabilities: ['chat', 'reasoning', 'retrieval', 'structured_output'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o', 'llama-3.1-70b'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 5_000, monthly: 100_000 },
      recommendedAgents: ['router', 'memory', 'learning'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['health', 'wellness', 'fitness', 'nutrition', 'mental_health', 'tracking'],
    },
  ],
  [
    'family_pack',
    {
      id: 'family_pack',
      name: 'Family & Personal Assistant Pack',
      description:
        'Family management and personal assistant apps — scheduling, reminders, meal planning, and family coordination.',
      capabilities: ['chat', 'voice', 'structured_output', 'agents'],
      allowedProviders: ['openai', 'groq'],
      recommendedModels: ['gpt-4o-mini', 'llama-3.1-8b'],
      safetyLevel: 'strict',
      defaultBudget: { daily: 4_000, monthly: 80_000 },
      recommendedAgents: ['router', 'memory', 'scheduler'],
      memoryStrategy: 'full',
      realtimeRequired: false,
      tags: ['family', 'personal', 'assistant', 'scheduling', 'planning', 'reminder'],
    },
  ],
])

// ── Category → keyword mapping ───────────────────────────

/** Maps broad category names to pack IDs via keyword matching. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  support_pack: ['support', 'helpdesk', 'customer', 'service', 'chat'],
  creator_pack: ['creator', 'marketing', 'content', 'creative', 'campaign'],
  companion_pack: ['companion', 'friend', 'social', 'conversational'],
  knowledge_pack: ['knowledge', 'education', 'religious', 'reference', 'learning', 'study'],
  dating_pack: ['dating', 'matchmaking', 'relationships', 'romance'],
  media_pack: ['music', 'media', 'audio', 'video', 'production'],
  voice_pack: ['voice', 'assistant', 'speech', 'realtime'],
  dev_pack: ['developer', 'coding', 'engineering', 'devtools', 'programming', 'code'],
  adult_18plus_pack: ['adult', '18+', 'age-verified', 'gated', 'nsfw'],
  research_pack: ['research', 'analysis', 'intelligence', 'scraping', 'data'],
  security_pack: ['security', 'monitoring', 'compliance', 'threat', 'audit'],
  operations_pack: ['operations', 'automation', 'workflow', 'scheduling'],
  pet_horse_pack: ['pet', 'horse', 'equestrian', 'animal', 'veterinary'],
  religious_pack: ['religious', 'faith', 'bible', 'church', 'spiritual', 'devotional', 'prayer', 'gospel'],
  education_pack: ['education', 'learning', 'tutoring', 'study', 'school', 'course', 'quiz', 'teaching'],
  smart_home_pack: ['smart_home', 'iot', 'automation', 'home', 'device', 'energy', 'smart'],
  health_pack: ['health', 'wellness', 'fitness', 'nutrition', 'mental_health', 'tracking', 'medical'],
  family_pack: ['family', 'personal', 'assistant', 'scheduling', 'planning', 'reminder', 'household'],
}

// ── Public API ───────────────────────────────────────────

/**
 * Look up a single capability pack by its unique identifier.
 *
 * @returns the matching pack, or `undefined` if the id is unknown.
 */
export function getCapabilityPack(id: string): CapabilityPack | undefined {
  return CAPABILITY_PACKS.get(id)
}

/** Return every registered capability pack. */
export function getAllCapabilityPacks(): CapabilityPack[] {
  return Array.from(CAPABILITY_PACKS.values())
}

/**
 * Find packs whose tags or keyword associations match a free-text category.
 *
 * The search is case-insensitive and matches against both the pack's `tags`
 * array and the internal category-keyword map.
 */
export function getPacksForCategory(category: string): CapabilityPack[] {
  const needle = category.toLowerCase()

  const matchingIds = new Set<string>()

  // Match against keyword map
  for (const [packId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => needle.includes(kw) || kw.includes(needle))) {
      matchingIds.add(packId)
    }
  }

  // Match against pack tags
  for (const [packId, pack] of CAPABILITY_PACKS) {
    if (pack.tags.some((tag) => needle.includes(tag) || tag.includes(needle))) {
      matchingIds.add(packId)
    }
  }

  return Array.from(matchingIds)
    .map((id) => CAPABILITY_PACKS.get(id))
    .filter((p): p is CapabilityPack => p !== undefined)
}

/**
 * Validate whether a pack's safety level is compatible with the target app.
 *
 * Rules:
 * - The `adult_gated` pack requires the app to declare `isAdult: true`.
 * - Minor-facing apps may not use `adult_gated` or `relaxed` packs.
 */
export function validatePackSafety(
  packId: string,
  appFlags: AppSafetyFlags,
): PackSafetyResult {
  const pack = CAPABILITY_PACKS.get(packId)
  if (!pack) {
    return { valid: false, reason: `Unknown pack id: '${packId}'.` }
  }

  if (pack.safetyLevel === 'adult_gated' && !appFlags.isAdult) {
    return {
      valid: false,
      reason:
        'The adult_gated pack requires the app to declare isAdult: true and enforce age verification.',
    }
  }

  if (appFlags.isMinorFacing && pack.safetyLevel === 'adult_gated') {
    return {
      valid: false,
      reason: 'Minor-facing apps cannot use adult_gated packs.',
    }
  }

  if (appFlags.isMinorFacing && pack.safetyLevel === 'relaxed') {
    return {
      valid: false,
      reason: 'Minor-facing apps cannot use relaxed safety packs.',
    }
  }

  return { valid: true }
}

/**
 * Identify which capabilities the pack requires that are **not** present
 * in the supplied `availableCapabilities` list.
 *
 * Useful for surfacing missing infrastructure before an app goes live.
 */
export function getPackCapabilityGaps(
  packId: string,
  availableCapabilities: string[],
): string[] {
  const pack = CAPABILITY_PACKS.get(packId)
  if (!pack) {
    return []
  }

  const available = new Set(availableCapabilities)
  return pack.capabilities.filter((cap) => !available.has(cap))
}
