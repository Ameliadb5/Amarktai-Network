import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getBudgetSummary } from '@/lib/budget-tracker'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/budgets — return budget summary for all providers */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await getBudgetSummary()
    return NextResponse.json(summary)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load budgets' },
      { status: 500 },
    )
  }
}

/** POST /api/admin/budgets — upsert budget config for a provider */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { providerKey, monthlyBudgetUsd, warningThresholdPct, criticalThresholdPct, notes } = body

    if (!providerKey) {
      return NextResponse.json({ error: 'providerKey required' }, { status: 400 })
    }

    const budget = await prisma.providerBudget.upsert({
      where: { providerKey },
      create: {
        providerKey,
        monthlyBudgetUsd: monthlyBudgetUsd ?? null,
        warningThresholdPct: warningThresholdPct ?? 75,
        criticalThresholdPct: criticalThresholdPct ?? 90,
        notes: notes ?? '',
      },
      update: {
        monthlyBudgetUsd: monthlyBudgetUsd ?? null,
        warningThresholdPct: warningThresholdPct ?? 75,
        criticalThresholdPct: criticalThresholdPct ?? 90,
        notes: notes ?? '',
      },
    })

    return NextResponse.json(budget)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save budget' },
      { status: 500 },
    )
  }
}
