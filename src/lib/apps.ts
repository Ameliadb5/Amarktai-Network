/**
 * Amarktai Network — App Types & Status Config
 *
 * Type definitions and status display configuration for the Amarktai ecosystem.
 * App data is sourced from the registry API (/api/apps) — not hardcoded here.
 * The Product model in prisma/schema.prisma is the single source of truth.
 */

export type AppStatus =
  | 'live'
  | 'ready_to_deploy'
  | 'invite_only'
  | 'in_development'
  | 'coming_soon'
  | 'concept'
  | 'offline'

export type OnboardingStatus =
  | 'unconfigured'
  | 'discovered'
  | 'configuring'
  | 'configured'
  | 'connected'

/** Shape returned by /api/apps */
export interface AmarktaiApp {
  id: number
  name: string
  slug: string
  category: string
  shortDescription: string
  longDescription: string
  status: string
  featured: boolean
  primaryUrl: string
  hostedHere: boolean
  aiEnabled: boolean
  monitoringEnabled: boolean
  readyToDeploy: boolean
  connectedToBrain: boolean
  onboardingStatus: string
  sortOrder: number
}

export const STATUS_CONFIG: Record<string, { label: string; dotColor: string; textColor: string; bg: string }> = {
  live:            { label: 'Live',            dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
  ready_to_deploy: { label: 'Ready to Deploy', dotColor: 'bg-blue-400',    textColor: 'text-blue-400',    bg: 'border-blue-500/30 bg-blue-500/10' },
  invite_only:     { label: 'Invite Only',     dotColor: 'bg-violet-400',  textColor: 'text-violet-400',  bg: 'border-violet-500/30 bg-violet-500/10' },
  in_development:  { label: 'In Development',  dotColor: 'bg-amber-400',   textColor: 'text-amber-400',   bg: 'border-amber-500/30 bg-amber-500/10' },
  coming_soon:     { label: 'Coming Soon',     dotColor: 'bg-slate-400',   textColor: 'text-slate-400',   bg: 'border-slate-500/30 bg-slate-500/10' },
  concept:         { label: 'Concept',         dotColor: 'bg-purple-400',  textColor: 'text-purple-400',  bg: 'border-purple-500/30 bg-purple-500/10' },
  offline:         { label: 'Offline',         dotColor: 'bg-slate-500',   textColor: 'text-slate-500',   bg: 'border-slate-500/30 bg-slate-500/10' },
}

export const ONBOARDING_CONFIG: Record<OnboardingStatus, { label: string; color: string; bg: string }> = {
  unconfigured: { label: 'Unconfigured', color: 'text-slate-400',   bg: 'border-slate-500/30 bg-slate-500/10' },
  discovered:   { label: 'Discovered',   color: 'text-blue-400',    bg: 'border-blue-500/30 bg-blue-500/10' },
  configuring:  { label: 'Configuring',  color: 'text-amber-400',   bg: 'border-amber-500/30 bg-amber-500/10' },
  configured:   { label: 'Configured',   color: 'text-cyan-400',    bg: 'border-cyan-500/30 bg-cyan-500/10' },
  connected:    { label: 'Connected',    color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
}

// ── Canonical app names (used by contact/about pages as display hints) ──
// These reflect the live Amarktai ecosystem. Update when new apps go live.
const CANONICAL_APP_NAMES = [
  'Amarktai Network',
  'Amarktai Marketing',
  'Amarktai Travel',
  'EquiProfile',
  'Amarktai Online',
]

export function getAppCount(): number {
  return CANONICAL_APP_NAMES.length
}

export function getAppNames(): string[] {
  return CANONICAL_APP_NAMES
}

