import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { crawlAppWebsite, getFirecrawlStatus } from '@/lib/firecrawl'
import { executeCapability } from '@/lib/capability-router'
import { createArtifact } from '@/lib/artifact-store'

/**
 * POST /api/admin/apps/intelligence
 *
 * Crawls an app website via Firecrawl, summarises it via the Brain,
 * builds an App Intelligence Profile, recommends a model package, and
 * persists everything to the DB.
 *
 * Request body:
 * {
 *   appId?:      string   // optional — app slug to associate the profile with
 *   name:        string   // human-readable app name
 *   websiteUrl:  string   // URL to crawl
 *   description?: string  // optional operator-provided description
 * }
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

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const appId = typeof body.appId === 'string' ? body.appId.trim() : ''

  if (!websiteUrl) {
    return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 })
  }

  // Ensure URL is parseable
  try {
    new URL(websiteUrl)
  } catch {
    return NextResponse.json({ error: 'websiteUrl is not a valid URL' }, { status: 400 })
  }

  const firecrawlStatus = await getFirecrawlStatus()

  // ── Step 1: Crawl website via Firecrawl ───────────────────────────────────
  let crawlResult
  let crawlStatus: string
  let crawlContent = ''

  if (!firecrawlStatus.apiKeyConfigured) {
    crawlStatus = 'firecrawl_not_configured'
    crawlContent = description || `Website: ${websiteUrl}\nApp name: ${name}`
  } else {
    crawlResult = await crawlAppWebsite(websiteUrl)
    if (!crawlResult.success) {
      crawlStatus = 'crawl_failed'
      crawlContent = description || `Website: ${websiteUrl}\nApp name: ${name}`
    } else {
      crawlStatus = 'crawled'
      // Build a text summary of crawled content for brain analysis
      const pageTexts = crawlResult.pages
        .slice(0, 5)
        .map(p => `[${p.title || p.url}]\n${p.content.slice(0, 800)}`)
        .join('\n\n---\n\n')
      crawlContent = `App name: ${name}\nWebsite: ${websiteUrl}\n${description ? `Description: ${description}\n` : ''}\n\nCrawled content:\n${pageTexts}`
    }
  }

  // ── Step 2: Brain summarise/profile ──────────────────────────────────────
  const profilePrompt =
    `You are an AI business analyst. Based on the following website content, extract a structured app intelligence profile.\n\n` +
    `${crawlContent}\n\n` +
    `Return a JSON object with these exact keys (no extra text, no markdown, just JSON):\n` +
    `{\n` +
    `  "businessType": "...",\n` +
    `  "targetUsers": ["..."],\n` +
    `  "productsServices": ["..."],\n` +
    `  "tone": "...",\n` +
    `  "brandSummary": "...",\n` +
    `  "supportNeeds": ["..."],\n` +
    `  "contentTopics": ["..."],\n` +
    `  "risks": ["..."],\n` +
    `  "recommendedCapabilities": ["chat","code","image_generation","..."]\n` +
    `}\n` +
    `Pick recommendedCapabilities only from: chat, code, file_analysis, image_generation, image_edit, video_generation, music_generation, tts, stt, voice_response, scrape_website, research, app_build, deploy_plan`

  let profile: {
    businessType: string
    targetUsers: string[]
    productsServices: string[]
    tone: string
    brandSummary: string
    supportNeeds: string[]
    contentTopics: string[]
    risks: string[]
    recommendedCapabilities: string[]
  } = {
    businessType: '',
    targetUsers: [],
    productsServices: [],
    tone: 'professional',
    brandSummary: crawlResult?.summary ?? `Website analysis for ${name}`,
    supportNeeds: [],
    contentTopics: [],
    risks: [],
    recommendedCapabilities: crawlResult?.aiCapabilitiesNeeded ?? ['chat'],
  }

  try {
    const brainResult = await executeCapability({
      input: profilePrompt,
      capability: 'chat',
      saveArtifact: false,
    })

    if (brainResult.success && brainResult.output) {
      // Strip markdown code fences if present
      let raw = brainResult.output.trim()
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
      }
      const parsed = JSON.parse(raw) as typeof profile
      profile = { ...profile, ...parsed }
    }
  } catch {
    // Brain not available — use crawl result heuristics
    if (crawlResult) {
      profile.businessType = crawlResult.detectedNiche
      profile.recommendedCapabilities = crawlResult.aiCapabilitiesNeeded
    }
  }

  // ── Step 3: Build model package ──────────────────────────────────────────
  const modelPackage = {
    primary: 'genx',
    cheapFallbacks: ['gemini', 'qwen', 'groq', 'grok', 'openrouter'],
    image: profile.recommendedCapabilities.includes('image_generation') ? 'genx' : '',
    video: profile.recommendedCapabilities.includes('video_generation') ? 'genx' : '',
    voice: profile.recommendedCapabilities.includes('tts') || profile.recommendedCapabilities.includes('stt') ? 'genx' : '',
    music: profile.recommendedCapabilities.includes('music_generation') ? 'genx' : '',
    research: 'firecrawl',
  }

  // ── Step 4: Save crawl result as artifact (optional) ─────────────────────
  let artifactId: string | undefined
  try {
    const appSlug = appId || 'onboarding'
    const artifact = await createArtifact({
      appSlug,
      type: 'report',
      subType: 'intelligence_profile',
      title: `Intelligence Profile: ${name}`,
      description: `Firecrawl + brain profile for ${websiteUrl}`,
      content: JSON.stringify({ crawlStatus, profile, modelPackage, crawledAt: new Date().toISOString() }),
      mimeType: 'application/json',
    })
    artifactId = artifact.id
  } catch {
    // Artifact save optional — don't block on failure
  }

  // ── Step 5: Persist intelligence profile to DB ───────────────────────────
  const appSlugForProfile = appId || `intel-${Date.now()}`
  try {
    await prisma.appIntelligenceProfile.upsert({
      where: { appSlug: appSlugForProfile },
      update: {
        appName: name,
        websiteUrl,
        businessType: profile.businessType,
        crawlSummary: profile.brandSummary,
        brandTone: profile.tone,
        targetUsers: JSON.stringify(profile.targetUsers),
        productsServices: JSON.stringify(profile.productsServices),
        supportKnowledge: JSON.stringify(profile.supportNeeds),
        contentTopics: JSON.stringify(profile.contentTopics),
        risks: JSON.stringify(profile.risks),
        recommendedCapabilities: JSON.stringify(profile.recommendedCapabilities),
        recommendedModelPackage: JSON.stringify(modelPackage),
        crawlArtifactId: artifactId ?? null,
        lastCrawledAt: new Date(),
      },
      create: {
        appSlug: appSlugForProfile,
        appName: name,
        websiteUrl,
        businessType: profile.businessType,
        crawlSummary: profile.brandSummary,
        brandTone: profile.tone,
        targetUsers: JSON.stringify(profile.targetUsers),
        productsServices: JSON.stringify(profile.productsServices),
        supportKnowledge: JSON.stringify(profile.supportNeeds),
        contentTopics: JSON.stringify(profile.contentTopics),
        risks: JSON.stringify(profile.risks),
        recommendedCapabilities: JSON.stringify(profile.recommendedCapabilities),
        recommendedModelPackage: JSON.stringify(modelPackage),
        crawlArtifactId: artifactId ?? null,
        lastCrawledAt: new Date(),
      },
    })
  } catch {
    // DB save failure — still return the profile, just won't be persisted
  }

  return NextResponse.json({
    success: true,
    crawlStatus,
    firecrawlAvailable: firecrawlStatus.apiKeyConfigured,
    firecrawlWarning: firecrawlStatus.apiKeyConfigured
      ? undefined
      : 'Firecrawl API key not configured. Set FIRECRAWL_API_KEY via Admin → Settings → Service Integrations. Profile was built from provided description only.',
    profile,
    modelPackage,
    artifactId: artifactId ?? null,
    savedAppSlug: appSlugForProfile,
  })
}

/**
 * GET /api/admin/apps/intelligence?appSlug=...
 *
 * Retrieve the intelligence profile for an app.
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
      return NextResponse.json({ profile: null })
    }

    // Parse JSON fields
    const parse = (s: string) => { try { return JSON.parse(s) } catch { return [] } }
    return NextResponse.json({
      profile: {
        ...row,
        targetUsers: parse(row.targetUsers),
        productsServices: parse(row.productsServices),
        supportKnowledge: parse(row.supportKnowledge),
        contentTopics: parse(row.contentTopics),
        risks: parse(row.risks),
        recommendedCapabilities: parse(row.recommendedCapabilities),
        recommendedModelPackage: parse(row.recommendedModelPackage),
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load profile' },
      { status: 500 },
    )
  }
}
