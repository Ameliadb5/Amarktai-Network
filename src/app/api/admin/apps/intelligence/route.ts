import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { executeCapability } from '@/lib/capability-router'
import { getFirecrawlStatus } from '@/lib/firecrawl'

/**
 * POST /api/admin/apps/intelligence
 *
 * Firecrawl App Onboarding Intelligence
 *
 * 1. Crawls website via /api/brain/execute capability=scrape_website
 * 2. Summarises/profiles via capability=chat
 * 3. Builds App Intelligence Profile
 * 4. Recommends model package
 * 5. Persists to AppIntelligenceProfile DB table
 * 6. Returns profile + modelPackage + optional artifactId
 *
 * If Firecrawl key missing: returns warning + allows manual profile entry.
 * Never fakes crawl success.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const appId = typeof body.appId === 'string' ? body.appId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''

  if (!websiteUrl) {
    return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 })
  }

  // ── Firecrawl status check ─────────────────────────────────────────────────

  const firecrawlStatus = await getFirecrawlStatus()
  let crawlStatus: 'success' | 'missing_key' | 'failed' = 'success'
  let crawlContent = ''
  let crawlArtifactId: string | undefined

  if (!firecrawlStatus.available) {
    crawlStatus = 'missing_key'
  } else {
    // ── Step 1: Crawl the website ────────────────────────────────────────────
    const crawlResult = await executeCapability({
      input: websiteUrl,
      capability: 'scrape_website',
      saveArtifact: true,
      appId: appId || 'admin',
      metadata: { source: 'app_intelligence', appName: name },
    })

    if (!crawlResult.success) {
      crawlStatus = 'failed'
    } else {
      crawlContent = typeof crawlResult.output === 'string' ? crawlResult.output : ''
      crawlArtifactId = crawlResult.artifactId
    }
  }

  // ── Step 2: AI Profile generation ─────────────────────────────────────────
  // Always attempt profile generation even if crawl failed (use description as fallback)
  const contextForProfile = crawlContent
    ? `Website content from ${websiteUrl}:\n\n${crawlContent}`
    : description
      ? `App description provided by operator: ${description}`
      : `App name: ${name}. Website: ${websiteUrl}.`

  const profilePrompt =
    `You are an AI business analyst. Analyse this app/business and return a structured JSON profile.\n\n` +
    `Context:\n${contextForProfile}\n\n` +
    `Return ONLY valid JSON with this exact shape:\n` +
    `{\n` +
    `  "businessType": "string — ecommerce|saas|marketplace|service|media|education|health|finance|social|other",\n` +
    `  "targetUsers": ["string array of user segments"],\n` +
    `  "productsServices": ["string array of main products/services"],\n` +
    `  "tone": "string — professional|casual|friendly|authoritative|empathetic",\n` +
    `  "brandSummary": "2–3 sentence summary of the brand/business",\n` +
    `  "supportNeeds": ["string array of likely customer support topics"],\n` +
    `  "contentTopics": ["string array of key content topics"],\n` +
    `  "risks": ["string array of content/safety risks for AI"],\n` +
    `  "recommendedCapabilities": ["string array from: chat,code,image_generation,video_generation,music_generation,tts,stt,voice_response,research,scrape_website,file_analysis"]\n` +
    `}`

  let profile = buildDefaultProfile()
  let profileArtifactId: string | undefined

  try {
    const profileResult = await executeCapability({
      input: profilePrompt,
      capability: 'chat',
      saveArtifact: true,
      appId: appId || 'admin',
      metadata: { source: 'app_intelligence_profile', appName: name },
    })

    if (profileResult.success && typeof profileResult.output === 'string') {
      profileArtifactId = profileResult.artifactId
      const jsonMatch = profileResult.output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
          profile = {
            businessType: String(parsed.businessType ?? ''),
            targetUsers: toStringArray(parsed.targetUsers),
            productsServices: toStringArray(parsed.productsServices),
            tone: String(parsed.tone ?? 'professional'),
            brandSummary: String(parsed.brandSummary ?? ''),
            supportNeeds: toStringArray(parsed.supportNeeds),
            contentTopics: toStringArray(parsed.contentTopics),
            risks: toStringArray(parsed.risks),
            recommendedCapabilities: toStringArray(parsed.recommendedCapabilities),
          }
        } catch {
          // Keep default profile
        }
      }
    }
  } catch {
    // Keep default profile
  }

  // ── Step 3: Build model package recommendation ─────────────────────────────
  const modelPackage = buildModelPackage(profile.recommendedCapabilities, profile.businessType)

  // ── Step 4: Persist to DB ─────────────────────────────────────────────────
  const appSlug = appId || slugify(name) || 'unknown'
  let savedRecord = null
  try {
    savedRecord = await prisma.appIntelligenceProfile.upsert({
      where: { appSlug },
      update: {
        websiteUrl,
        businessType: profile.businessType,
        brandSummary: profile.brandSummary,
        brandTone: profile.tone,
        targetUsers: JSON.stringify(profile.targetUsers),
        productsServices: JSON.stringify(profile.productsServices),
        supportKnowledge: profile.supportNeeds.join('\n'),
        contentTopics: JSON.stringify(profile.contentTopics),
        risks: JSON.stringify(profile.risks),
        recommendedCapabilities: JSON.stringify(profile.recommendedCapabilities),
        recommendedModelPackage: JSON.stringify(modelPackage),
        crawlSummary: crawlContent.slice(0, 2000),
        crawlArtifactId: crawlArtifactId ?? null,
        lastCrawledAt: crawlStatus === 'success' ? new Date() : undefined,
      },
      create: {
        appSlug,
        websiteUrl,
        businessType: profile.businessType,
        brandSummary: profile.brandSummary,
        brandTone: profile.tone,
        targetUsers: JSON.stringify(profile.targetUsers),
        productsServices: JSON.stringify(profile.productsServices),
        supportKnowledge: profile.supportNeeds.join('\n'),
        contentTopics: JSON.stringify(profile.contentTopics),
        risks: JSON.stringify(profile.risks),
        recommendedCapabilities: JSON.stringify(profile.recommendedCapabilities),
        recommendedModelPackage: JSON.stringify(modelPackage),
        crawlSummary: crawlContent.slice(0, 2000),
        crawlArtifactId: crawlArtifactId ?? null,
        lastCrawledAt: crawlStatus === 'success' ? new Date() : null,
      },
    })
  } catch {
    // Non-fatal: return profile even if DB write fails
  }

  // ── Response ───────────────────────────────────────────────────────────────
  const warnings: string[] = []
  if (crawlStatus === 'missing_key') {
    warnings.push(
      'FIRECRAWL_API_KEY is not configured. Set it via Admin → Settings → Service Integrations. ' +
        'Profile was generated from the description you provided. Re-run after adding the key for a full crawl.',
    )
  } else if (crawlStatus === 'failed') {
    warnings.push('Firecrawl crawl failed. Profile was generated from the description you provided.')
  }

  return NextResponse.json({
    success: true,
    crawlStatus,
    warnings: warnings.length ? warnings : undefined,
    profile,
    modelPackage,
    artifactId: profileArtifactId ?? crawlArtifactId,
    crawlArtifactId,
    profileArtifactId,
    savedProfileId: savedRecord?.id,
    appSlug,
    firecrawlAvailable: firecrawlStatus.available,
  })
}

/**
 * GET /api/admin/apps/intelligence?appSlug=...
 *
 * Returns the saved intelligence profile for a given app slug.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const appSlug = searchParams.get('appSlug')

  if (!appSlug) {
    return NextResponse.json({ error: 'appSlug query param required' }, { status: 400 })
  }

  try {
    const row = await prisma.appIntelligenceProfile.findUnique({ where: { appSlug } })
    if (!row) {
      return NextResponse.json({ profile: null, found: false })
    }

    const profile = deserialiseProfile(row)
    return NextResponse.json({ profile, found: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 },
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultProfile() {
  return {
    businessType: '',
    targetUsers: [] as string[],
    productsServices: [] as string[],
    tone: 'professional',
    brandSummary: '',
    supportNeeds: [] as string[],
    contentTopics: [] as string[],
    risks: [] as string[],
    recommendedCapabilities: ['chat'] as string[],
  }
}

function buildModelPackage(capabilities: string[], businessType: string) {
  const hasImage = capabilities.includes('image_generation')
  const hasVideo = capabilities.includes('video_generation')
  const hasVoice = capabilities.some(c => ['tts', 'stt', 'voice_response'].includes(c))
  const hasMusic = capabilities.includes('music_generation')
  const hasResearch = capabilities.some(c => ['research', 'scrape_website'].includes(c))

  // Cheap fallbacks in preference order
  const cheapFallbacks = ['gemini', 'qwen', 'groq', 'grok', 'openrouter']

  // Safety-sensitive businesses get premium primary
  const safetySensitive = ['health', 'finance', 'education', 'legal'].includes(businessType)

  return {
    primary: 'genx',
    cheapFallbacks,
    image: hasImage ? 'genx' : '',
    video: hasVideo ? 'genx' : '',
    voice: hasVoice ? 'genx' : '',
    music: hasMusic ? 'genx' : '',
    research: hasResearch ? 'firecrawl' : '',
    preferPremium: safetySensitive,
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch { /* ignore */ }
    return [value]
  }
  return []
}

function slugify(v: string): string {
  return v
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function deserialiseProfile(row: {
  id: string; appSlug: string; websiteUrl: string; businessType: string;
  brandSummary: string; brandTone: string; targetUsers: string;
  productsServices: string; supportKnowledge: string; contentTopics: string;
  risks: string; recommendedCapabilities: string; recommendedModelPackage: string;
  crawlSummary: string; crawlArtifactId: string | null; lastCrawledAt: Date | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id,
    appSlug: row.appSlug,
    websiteUrl: row.websiteUrl,
    businessType: row.businessType,
    brandSummary: row.brandSummary,
    tone: row.brandTone,
    targetUsers: parseJsonArray(row.targetUsers),
    productsServices: parseJsonArray(row.productsServices),
    supportKnowledge: row.supportKnowledge,
    contentTopics: parseJsonArray(row.contentTopics),
    risks: parseJsonArray(row.risks),
    recommendedCapabilities: parseJsonArray(row.recommendedCapabilities),
    recommendedModelPackage: (() => {
      try { return JSON.parse(row.recommendedModelPackage) as Record<string, unknown> } catch { return {} }
    })(),
    crawlSummary: row.crawlSummary,
    crawlArtifactId: row.crawlArtifactId,
    lastCrawledAt: row.lastCrawledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch { /* ignore */ }
  return []
}
