/**
 * Amarktai Network — Single Source of Truth for Ecosystem Apps
 *
 * This file is the ONLY place where app metadata is defined in the frontend.
 * All public pages (apps, contact, homepage) and admin pages consume this data.
 *
 * In a future backend phase, this can be replaced with API calls to /api/admin/products.
 * Until then, this is the canonical app registry.
 */

export type AppStatus = 'live' | 'ready_to_deploy' | 'invite_only' | 'in_development' | 'offline'

export interface AmarktaiApp {
  id: number
  name: string
  slug: string
  code: string
  description: string
  longDescription: string
  category: string
  categoryKey: string
  status: AppStatus
  featured: boolean
  publicUrl?: string
  aiConnected: boolean
  monitoredByDashboard: boolean
  readyForDeployment: boolean
  capabilities: string[]
  icon: string // lucide icon name
}

/**
 * The canonical Amarktai ecosystem app list.
 * Updated manually until backend phase provides /api/admin/apps.
 */
export const ECOSYSTEM_APPS: AmarktaiApp[] = [
  {
    id: 1,
    name: 'EquiProfile',
    slug: 'equiprofile',
    code: 'AMKN-001',
    description: 'Professional equity profiling and financial intelligence for serious investors.',
    longDescription:
      'EquiProfile delivers deep equity analysis and financial profiling tools for investors who demand precision. Comprehensive company profiles, financial metrics, and investment intelligence in one clean platform.',
    category: 'Finance & Web',
    categoryKey: 'finance',
    status: 'live',
    featured: true,
    publicUrl: 'https://equiprofile.online',
    aiConnected: false,
    monitoredByDashboard: true,
    readyForDeployment: true,
    capabilities: ['Equity Analysis', 'Financial Profiles', 'Investment Intelligence', 'Market Data'],
    icon: 'BarChart2',
  },
  {
    id: 2,
    name: 'Amarktai Marketing',
    slug: 'amarktai-marketing',
    code: 'AMKN-002',
    description: 'AI-powered marketing intelligence and automation for modern growth teams.',
    longDescription:
      'Amarktai Marketing brings AI-driven campaign intelligence, audience segmentation, and automated growth workflows to teams that demand results. Built for performance marketers operating at scale.',
    category: 'Marketing & AI',
    categoryKey: 'marketing',
    status: 'in_development',
    featured: false,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['AI Campaigns', 'Audience Intelligence', 'Automation', 'Growth Analytics'],
    icon: 'Megaphone',
  },
  {
    id: 3,
    name: 'Amarktai Family',
    slug: 'amarktai-family',
    code: 'AMKN-003',
    description: 'Community-driven platform fostering meaningful family and community connections.',
    longDescription:
      'Amarktai Family is a community platform focused on quality of connection over quantity. Shared interests, family groups, and collaborative experiences form the foundation of genuine digital community.',
    category: 'Social',
    categoryKey: 'social',
    status: 'in_development',
    featured: false,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['Community', 'Family Groups', 'Shared Interests', 'Real Connections'],
    icon: 'Users',
  },
  {
    id: 4,
    name: 'Amarktai Crypto',
    slug: 'amarktai-crypto',
    code: 'AMKN-004',
    description: 'Advanced cryptocurrency intelligence platform with real-time AI signals and portfolio analytics.',
    longDescription:
      'Amarktai Crypto is an institutional-grade cryptocurrency intelligence platform. It delivers real-time AI-driven market signals, deep portfolio analytics, risk modeling, and on-chain data insights — all in one unified interface.',
    category: 'Finance & AI',
    categoryKey: 'finance',
    status: 'invite_only',
    featured: true,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['AI Signals', 'Portfolio Analytics', 'Risk Modeling', 'On-Chain Data'],
    icon: 'TrendingUp',
  },
  {
    id: 5,
    name: 'Amarktai Forex',
    slug: 'amarktai-forex',
    code: 'AMKN-005',
    description: 'Institutional-grade forex analysis powered by proprietary AI models and market intelligence.',
    longDescription:
      'Amarktai Forex delivers deep forex market intelligence using proprietary AI models trained on decades of price data, sentiment analysis, and macro indicators. Built for serious traders and institutions.',
    category: 'Finance & AI',
    categoryKey: 'finance',
    status: 'invite_only',
    featured: true,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['AI Models', 'Macro Intelligence', 'Sentiment Analysis', 'FX Signals'],
    icon: 'Globe',
  },
  {
    id: 6,
    name: 'Faith Haven',
    slug: 'faith-haven',
    code: 'AMKN-006',
    description: 'A digital sanctuary for faith communities to connect, grow, and build meaningful relationships.',
    longDescription:
      'Faith Haven is a purpose-built digital space for faith communities. It offers spaces for prayer, discussion, events, and community building — all in a respectful, ad-free environment.',
    category: 'Community',
    categoryKey: 'community',
    status: 'in_development',
    featured: false,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['Community', 'Events', 'Discussion', 'Prayer'],
    icon: 'Heart',
  },
  {
    id: 7,
    name: 'Learn Digital',
    slug: 'learn-digital',
    code: 'AMKN-007',
    description: 'Adaptive digital learning platform for the next generation of technology professionals.',
    longDescription:
      'Learn Digital is an adaptive learning platform designed to produce the next generation of digital professionals. AI-personalized curricula, project-based learning, and industry mentorship.',
    category: 'Education',
    categoryKey: 'education',
    status: 'in_development',
    featured: false,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['Adaptive Learning', 'AI Personalization', 'Mentorship', 'Certificates'],
    icon: 'BookOpen',
  },
  {
    id: 8,
    name: 'Jobs SA',
    slug: 'jobs-sa',
    code: 'AMKN-008',
    description: 'South Africa-focused AI job matching platform connecting talent with opportunity.',
    longDescription:
      'Jobs SA is an intelligent job matching platform focused on the South African market. AI matching connects candidates with roles where they will genuinely thrive, not just roles they qualify for.',
    category: 'Employment',
    categoryKey: 'employment',
    status: 'in_development',
    featured: false,
    aiConnected: false,
    monitoredByDashboard: false,
    readyForDeployment: false,
    capabilities: ['AI Matching', 'South Africa', 'Talent Network', 'Smart Search'],
    icon: 'Briefcase',
  },
]

// ── Helpers ──────────────────────────────────────────────

export const STATUS_CONFIG: Record<AppStatus, { label: string; dotColor: string; textColor: string; bg: string }> = {
  live:             { label: 'Live',            dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
  ready_to_deploy:  { label: 'Ready to Deploy', dotColor: 'bg-blue-400',    textColor: 'text-blue-400',    bg: 'border-blue-500/30 bg-blue-500/10' },
  invite_only:      { label: 'Invite Only',     dotColor: 'bg-violet-400',  textColor: 'text-violet-400',  bg: 'border-violet-500/30 bg-violet-500/10' },
  in_development:   { label: 'In Development',  dotColor: 'bg-amber-400',   textColor: 'text-amber-400',   bg: 'border-amber-500/30 bg-amber-500/10' },
  offline:          { label: 'Offline',          dotColor: 'bg-slate-500',   textColor: 'text-slate-500',   bg: 'border-slate-500/30 bg-slate-500/10' },
}

export function getAppsByStatus(status: AppStatus): AmarktaiApp[] {
  return ECOSYSTEM_APPS.filter(app => app.status === status)
}

export function getLiveApps(): AmarktaiApp[] {
  return getAppsByStatus('live')
}

export function getAppNames(): string[] {
  return ECOSYSTEM_APPS.map(app => app.name)
}

export function getAppCount(): number {
  return ECOSYSTEM_APPS.length
}
