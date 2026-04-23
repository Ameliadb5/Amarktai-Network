/**
 * First-Run Onboarding — Fresh Install Detection & Setup Wizard
 *
 * Detects whether the AmarktAI Network instance is a fresh install
 * and guides the admin through initial configuration:
 *
 *   1. Admin account creation (if no admin user exists)
 *   2. AI provider setup (at least one API key)
 *   3. First app creation (via the onboarding wizard)
 *   4. Health verification (providers responding)
 *
 * The onboarding state is checked at login and on dashboard load.
 * Once all steps are complete, onboarding is marked done and the
 * redirect stops.
 *
 * Server-side only — no browser APIs.
 */

import { prisma } from './prisma'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  id: string
  label: string
  description: string
  completed: boolean
  route: string
}

export interface OnboardingStatus {
  /** True if all required steps are complete. */
  completed: boolean
  /** Individual step statuses. */
  steps: OnboardingStep[]
  /** Percentage complete (0–100). */
  progress: number
  /** The next step the admin should complete. */
  nextStep: OnboardingStep | null
  /** Timestamp of the check. */
  checkedAt: string
}

// ── Step Definitions ─────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    id: 'admin_account',
    label: 'Create Admin Account',
    description: 'Set up your administrator login credentials.',
    route: '/admin/setup',
  },
  {
    id: 'provider_setup',
    label: 'Configure AI Provider',
    description: 'Add at least one AI provider API key (e.g., OpenAI, Groq, DeepSeek).',
    route: '/admin/dashboard/operations',
  },
  {
    id: 'first_app',
    label: 'Create First App',
    description: 'Create your first connected app using the onboarding wizard.',
    route: '/admin/dashboard/apps/new',
  },
  {
    id: 'health_check',
    label: 'Verify Provider Health',
    description: 'Confirm at least one AI provider is responding correctly.',
    route: '/admin/dashboard/operations',
  },
] as const

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the full onboarding status.
 *
 * Queries the database to determine which onboarding steps have been
 * completed. Returns the status with progress percentage.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const [adminCount, providerCount, appCount, healthyProviderCount] = await Promise.all([
    checkAdminExists(),
    checkProviderConfigured(),
    checkAppExists(),
    checkProviderHealthy(),
  ])

  const completionMap: Record<string, boolean> = {
    admin_account:  adminCount,
    provider_setup: providerCount,
    first_app:      appCount,
    health_check:   healthyProviderCount,
  }

  const steps: OnboardingStep[] = ONBOARDING_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    completed: completionMap[step.id] ?? false,
    route: step.route,
  }))

  const completedCount = steps.filter((s) => s.completed).length
  const progress = Math.round((completedCount / steps.length) * 100)
  const completed = completedCount === steps.length
  const nextStep = steps.find((s) => !s.completed) ?? null

  return {
    completed,
    steps,
    progress,
    nextStep,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Quick check: is this a first-run install?
 * Returns true if no admin user exists (most fundamental check).
 */
export async function isFirstRun(): Promise<boolean> {
  return !(await checkAdminExists())
}

/**
 * Quick check: is onboarding complete?
 * Returns true only when all 4 steps are done.
 */
export async function isOnboardingComplete(): Promise<boolean> {
  const status = await getOnboardingStatus()
  return status.completed
}

// ── Step Checks ──────────────────────────────────────────────────────────────

async function checkAdminExists(): Promise<boolean> {
  try {
    const count = await prisma.adminUser.count()
    return count > 0
  } catch {
    return false
  }
}

async function checkProviderConfigured(): Promise<boolean> {
  try {
    const count = await prisma.aiProvider.count({
      where: {
        apiKey: { not: '' },
        enabled: true,
      },
    })
    return count > 0
  } catch {
    return false
  }
}

async function checkAppExists(): Promise<boolean> {
  try {
    const count = await prisma.product.count()
    return count > 0
  } catch {
    return false
  }
}

async function checkProviderHealthy(): Promise<boolean> {
  try {
    const count = await prisma.aiProvider.count({
      where: {
        healthStatus: 'healthy',
        enabled: true,
      },
    })
    return count > 0
  } catch {
    return false
  }
}
