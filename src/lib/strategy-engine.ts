/**
 * Strategy Engine — per-app goals, KPIs, recommendations.
 *
 * Each connected app can have:
 *  - goals (e.g. "increase traffic", "reduce unresolved tickets")
 *  - KPI targets (e.g. CTR > 3%, CSAT > 4.2)
 *  - current strategy state
 *  - recommended next actions
 *
 * The engine converts outcome data into actionable recommendations
 * and feeds learning into future routing/behavior.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppGoal {
  id: string;
  label: string;
  metric: string;
  targetValue: number;
  currentValue: number | null;
  direction: 'increase' | 'decrease' | 'maintain';
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface KpiTarget {
  metric: string;
  label: string;
  targetValue: number;
  currentValue: number | null;
  unit: string;
  direction: 'increase' | 'decrease' | 'maintain';
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'unknown';
}

export interface StrategyRecommendation {
  id: string;
  type: 'routing' | 'model' | 'capability' | 'budget' | 'content' | 'engagement' | 'operational';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  appSlug: string;
  createdAt: string;
}

export interface AppStrategy {
  appSlug: string;
  appName: string;
  appType: string;
  goals: AppGoal[];
  kpis: KpiTarget[];
  recommendations: StrategyRecommendation[];
  strategyState: 'active' | 'setup' | 'paused' | 'not_configured';
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// In-memory store (replaced by DB persistence below)
// ---------------------------------------------------------------------------

import { prisma } from './prisma'

let idCounter = 1;

// ── DB helpers ───────────────────────────────────────────────────────────────

function rowToStrategy(row: {
  appSlug: string
  appName: string
  appType: string
  goals: string
  kpis: string
  recommendations: string
  strategyState: string
  lastUpdated?: Date | null
  updatedAt?: Date | null
}): AppStrategy {
  const ts = row.lastUpdated ?? row.updatedAt ?? new Date()
  return {
    appSlug: row.appSlug,
    appName: row.appName,
    appType: row.appType,
    goals: JSON.parse(row.goals) as AppGoal[],
    kpis: JSON.parse(row.kpis) as KpiTarget[],
    recommendations: JSON.parse(row.recommendations) as StrategyRecommendation[],
    strategyState: row.strategyState as AppStrategy['strategyState'],
    lastUpdated: ts instanceof Date ? ts.toISOString() : String(ts),
  };
}

// ---------------------------------------------------------------------------
// Default strategies by app type
// ---------------------------------------------------------------------------

interface StrategyTemplate {
  goals: Omit<AppGoal, 'id' | 'currentValue' | 'createdAt'>[];
  kpis: Omit<KpiTarget, 'currentValue' | 'status'>[];
}

const STRATEGY_TEMPLATES: Record<string, StrategyTemplate> = {
  marketing: {
    goals: [
      { label: 'Increase organic traffic', metric: 'organic_traffic', targetValue: 10000, direction: 'increase', priority: 'high' },
      { label: 'Improve click-through rate', metric: 'ctr', targetValue: 3.5, direction: 'increase', priority: 'high' },
      { label: 'Reduce bounce rate', metric: 'bounce_rate', targetValue: 40, direction: 'decrease', priority: 'medium' },
    ],
    kpis: [
      { metric: 'ctr', label: 'Click-Through Rate', targetValue: 3.5, unit: '%', direction: 'increase' },
      { metric: 'conversion_rate', label: 'Conversion Rate', targetValue: 2.0, unit: '%', direction: 'increase' },
      { metric: 'engagement_score', label: 'Engagement Score', targetValue: 75, unit: 'pts', direction: 'increase' },
    ],
  },
  support: {
    goals: [
      { label: 'Reduce unresolved tickets', metric: 'unresolved_tickets', targetValue: 50, direction: 'decrease', priority: 'critical' },
      { label: 'Improve resolution time', metric: 'avg_resolution_time_hrs', targetValue: 4, direction: 'decrease', priority: 'high' },
      { label: 'Increase customer satisfaction', metric: 'csat', targetValue: 4.5, direction: 'increase', priority: 'high' },
    ],
    kpis: [
      { metric: 'csat', label: 'CSAT Score', targetValue: 4.5, unit: '/5', direction: 'increase' },
      { metric: 'first_response_time_min', label: 'First Response Time', targetValue: 5, unit: 'min', direction: 'decrease' },
      { metric: 'ticket_resolution_rate', label: 'Resolution Rate', targetValue: 95, unit: '%', direction: 'increase' },
    ],
  },
  trading: {
    goals: [
      { label: 'Improve decision accuracy', metric: 'decision_accuracy', targetValue: 80, direction: 'increase', priority: 'critical' },
      { label: 'Reduce bad trades', metric: 'bad_trade_rate', targetValue: 10, direction: 'decrease', priority: 'high' },
      { label: 'Increase profit factor', metric: 'profit_factor', targetValue: 1.5, direction: 'increase', priority: 'high' },
    ],
    kpis: [
      { metric: 'win_rate', label: 'Win Rate', targetValue: 60, unit: '%', direction: 'increase' },
      { metric: 'avg_return', label: 'Avg Return per Trade', targetValue: 2, unit: '%', direction: 'increase' },
      { metric: 'max_drawdown', label: 'Max Drawdown', targetValue: 15, unit: '%', direction: 'decrease' },
    ],
  },
  media: {
    goals: [
      { label: 'Improve content performance', metric: 'content_engagement', targetValue: 1000, direction: 'increase', priority: 'high' },
      { label: 'Increase audience reach', metric: 'audience_reach', targetValue: 50000, direction: 'increase', priority: 'high' },
      { label: 'Reduce content production cost', metric: 'cost_per_content', targetValue: 5, direction: 'decrease', priority: 'medium' },
    ],
    kpis: [
      { metric: 'views_per_content', label: 'Views per Content', targetValue: 5000, unit: '', direction: 'increase' },
      { metric: 'engagement_rate', label: 'Engagement Rate', targetValue: 8, unit: '%', direction: 'increase' },
      { metric: 'content_output', label: 'Weekly Content Output', targetValue: 20, unit: 'pieces', direction: 'increase' },
    ],
  },
  dating: {
    goals: [
      { label: 'Improve user retention', metric: 'retention_7d', targetValue: 60, direction: 'increase', priority: 'critical' },
      { label: 'Increase match quality', metric: 'match_satisfaction', targetValue: 4.0, direction: 'increase', priority: 'high' },
      { label: 'Grow active interactions', metric: 'daily_interactions', targetValue: 5000, direction: 'increase', priority: 'high' },
    ],
    kpis: [
      { metric: 'retention_7d', label: '7-Day Retention', targetValue: 60, unit: '%', direction: 'increase' },
      { metric: 'messages_per_match', label: 'Messages per Match', targetValue: 8, unit: '', direction: 'increase' },
      { metric: 'daily_active_users', label: 'Daily Active Users', targetValue: 10000, unit: '', direction: 'increase' },
    ],
  },
  general: {
    goals: [
      { label: 'Improve AI task success rate', metric: 'task_success_rate', targetValue: 95, direction: 'increase', priority: 'high' },
      { label: 'Reduce AI response latency', metric: 'avg_latency_ms', targetValue: 500, direction: 'decrease', priority: 'medium' },
      { label: 'Optimize AI cost efficiency', metric: 'cost_per_task', targetValue: 0.01, direction: 'decrease', priority: 'medium' },
    ],
    kpis: [
      { metric: 'task_success_rate', label: 'Task Success Rate', targetValue: 95, unit: '%', direction: 'increase' },
      { metric: 'avg_latency_ms', label: 'Avg Latency', targetValue: 500, unit: 'ms', direction: 'decrease' },
      { metric: 'monthly_ai_cost', label: 'Monthly AI Cost', targetValue: 100, unit: 'USD', direction: 'decrease' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function nextId(prefix: string): string {
  return `${prefix}_${idCounter++}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function kpiStatus(kpi: Pick<KpiTarget, 'targetValue' | 'currentValue' | 'direction'>): KpiTarget['status'] {
  if (kpi.currentValue === null) return 'unknown';
  const ratio = kpi.currentValue / (kpi.targetValue || 1);
  if (kpi.direction === 'increase') {
    if (ratio >= 1) return 'achieved';
    if (ratio >= 0.8) return 'on_track';
    if (ratio >= 0.5) return 'at_risk';
    return 'behind';
  }
  if (kpi.direction === 'decrease') {
    if (ratio <= 1) return 'achieved';
    if (ratio <= 1.2) return 'on_track';
    if (ratio <= 1.5) return 'at_risk';
    return 'behind';
  }
  // maintain
  if (Math.abs(ratio - 1) <= 0.1) return 'achieved';
  return 'at_risk';
}

/**
 * Initialize strategy for an app based on its type.
 */
export async function initializeStrategy(
  appSlug: string,
  appName: string,
  appType: string,
): Promise<AppStrategy> {
  const template = STRATEGY_TEMPLATES[appType] ?? STRATEGY_TEMPLATES.general;
  const now = new Date().toISOString();

  const goals: AppGoal[] = template.goals.map((g) => ({
    ...g,
    id: nextId('goal'),
    currentValue: null,
    createdAt: now,
  }));

  const kpis: KpiTarget[] = template.kpis.map((k) => ({
    ...k,
    currentValue: null,
    status: 'unknown' as const,
  }));

  const strategy: AppStrategy = {
    appSlug,
    appName,
    appType,
    goals,
    kpis,
    recommendations: [],
    strategyState: 'setup',
    lastUpdated: now,
  };

  await prisma.appStrategyRecord.upsert({
    where: { appSlug },
    create: {
      appSlug,
      appName,
      appType,
      goals: JSON.stringify(goals),
      kpis: JSON.stringify(kpis),
      recommendations: '[]',
      strategyState: 'setup',
    },
    update: {
      appName,
      appType,
      goals: JSON.stringify(goals),
      kpis: JSON.stringify(kpis),
      recommendations: '[]',
      strategyState: 'setup',
    },
  });
  return strategy;
}

/**
 * Get strategy for an app. Returns null if not initialized.
 */
export async function getAppStrategy(appSlug: string): Promise<AppStrategy | null> {
  try {
    const row = await prisma.appStrategyRecord.findUnique({ where: { appSlug } });
    return row ? rowToStrategy(row) : null;
  } catch {
    return null;
  }
}

/**
 * Update KPI current values and recompute status.
 */
export async function updateKpis(
  appSlug: string,
  updates: Record<string, number>,
): Promise<AppStrategy | null> {
  const strategy = await getAppStrategy(appSlug);
  if (!strategy) return null;

  for (const kpi of strategy.kpis) {
    if (updates[kpi.metric] !== undefined) {
      kpi.currentValue = updates[kpi.metric];
      kpi.status = kpiStatus(kpi);
    }
  }
  for (const goal of strategy.goals) {
    if (updates[goal.metric] !== undefined) {
      goal.currentValue = updates[goal.metric];
    }
  }

  await prisma.appStrategyRecord.update({
    where: { appSlug },
    data: { goals: JSON.stringify(strategy.goals), kpis: JSON.stringify(strategy.kpis) },
  });
  return strategy;
}

/**
 * Add a custom goal.
 */
export async function addGoal(
  appSlug: string,
  goal: Omit<AppGoal, 'id' | 'createdAt'>,
): Promise<AppStrategy | null> {
  const strategy = await getAppStrategy(appSlug);
  if (!strategy) return null;

  strategy.goals.push({ ...goal, id: nextId('goal'), createdAt: new Date().toISOString() });
  await prisma.appStrategyRecord.update({
    where: { appSlug },
    data: { goals: JSON.stringify(strategy.goals) },
  });
  return strategy;
}

/**
 * Remove a goal by id.
 */
export async function removeGoal(appSlug: string, goalId: string): Promise<boolean> {
  const strategy = await getAppStrategy(appSlug);
  if (!strategy) return false;
  const before = strategy.goals.length;
  strategy.goals = strategy.goals.filter((g) => g.id !== goalId);
  await prisma.appStrategyRecord.update({
    where: { appSlug },
    data: { goals: JSON.stringify(strategy.goals) },
  });
  return strategy.goals.length < before;
}

/**
 * Generate recommendations based on current KPI state and outcome data.
 */
export async function generateRecommendations(
  appSlug: string,
  outcomeData?: {
    successRate?: number;
    avgLatencyMs?: number;
    fallbackRate?: number;
    topModel?: string;
    monthlySpend?: number;
  },
): Promise<StrategyRecommendation[]> {
  const strategy = await getAppStrategy(appSlug);
  if (!strategy) return [];

  const recs: StrategyRecommendation[] = [];
  const now = new Date().toISOString();

  for (const kpi of strategy.kpis) {
    if (kpi.status === 'behind') {
      recs.push({
        id: nextId('rec'),
        type: 'operational',
        title: `${kpi.label} is behind target`,
        description: `Current: ${kpi.currentValue ?? 'N/A'} ${kpi.unit}. Target: ${kpi.targetValue} ${kpi.unit}. Consider adjusting strategy or resources to improve this metric.`,
        impact: 'high',
        effort: 'medium',
        appSlug,
        createdAt: now,
      });
    } else if (kpi.status === 'at_risk') {
      recs.push({
        id: nextId('rec'),
        type: 'operational',
        title: `${kpi.label} is at risk`,
        description: `Current: ${kpi.currentValue ?? 'N/A'} ${kpi.unit}. Target: ${kpi.targetValue} ${kpi.unit}. Monitor closely and consider preemptive action.`,
        impact: 'medium',
        effort: 'low',
        appSlug,
        createdAt: now,
      });
    }
  }

  if (outcomeData) {
    if (outcomeData.successRate !== undefined && outcomeData.successRate < 90) {
      recs.push({
        id: nextId('rec'),
        type: 'routing',
        title: 'AI task success rate is low',
        description: `Current success rate: ${outcomeData.successRate.toFixed(1)}%. Consider upgrading model tier or reviewing routing configuration.`,
        impact: 'high',
        effort: 'low',
        appSlug,
        createdAt: now,
      });
    }
    if (outcomeData.fallbackRate !== undefined && outcomeData.fallbackRate > 15) {
      recs.push({
        id: nextId('rec'),
        type: 'routing',
        title: 'High fallback rate detected',
        description: `Fallback rate: ${outcomeData.fallbackRate.toFixed(1)}%. Primary provider may be unreliable. Consider configuring additional providers.`,
        impact: 'medium',
        effort: 'medium',
        appSlug,
        createdAt: now,
      });
    }
    if (outcomeData.avgLatencyMs !== undefined && outcomeData.avgLatencyMs > 2000) {
      recs.push({
        id: nextId('rec'),
        type: 'model',
        title: 'High AI response latency',
        description: `Avg latency: ${outcomeData.avgLatencyMs.toFixed(0)}ms. Consider switching to faster models or providers (e.g., Groq).`,
        impact: 'medium',
        effort: 'low',
        appSlug,
        createdAt: now,
      });
    }
  }

  const newState = strategy.strategyState === 'setup' && recs.length > 0 ? 'active' : strategy.strategyState;
  await prisma.appStrategyRecord.update({
    where: { appSlug },
    data: { recommendations: JSON.stringify(recs), strategyState: newState },
  });
  return recs;
}

/**
 * Activate/pause strategy for an app.
 */
export async function setStrategyState(
  appSlug: string,
  state: AppStrategy['strategyState'],
): Promise<boolean> {
  try {
    await prisma.appStrategyRecord.update({ where: { appSlug }, data: { strategyState: state } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all app strategies.
 */
export async function getAllStrategies(): Promise<AppStrategy[]> {
  try {
    const rows = await prisma.appStrategyRecord.findMany();
    return rows.map(rowToStrategy);
  } catch {
    return [];
  }
}

/**
 * Get strategy summary for dashboard.
 */
export async function getStrategySummary(): Promise<{
  totalApps: number;
  activeStrategies: number;
  atRiskKpis: number;
  behindKpis: number;
  totalRecommendations: number;
}> {
  const all = await getAllStrategies();
  let atRiskKpis = 0;
  let behindKpis = 0;
  let totalRecommendations = 0;

  for (const s of all) {
    for (const kpi of s.kpis) {
      if (kpi.status === 'at_risk') atRiskKpis++;
      if (kpi.status === 'behind') behindKpis++;
    }
    totalRecommendations += s.recommendations.length;
  }

  return {
    totalApps: all.length,
    activeStrategies: all.filter((s) => s.strategyState === 'active').length,
    atRiskKpis,
    behindKpis,
    totalRecommendations,
  };
}

/**
 * Remove strategy for an app.
 */
export async function removeStrategy(appSlug: string): Promise<boolean> {
  try {
    await prisma.appStrategyRecord.delete({ where: { appSlug } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset all strategies (for testing).
 */
export async function resetStrategies(): Promise<void> {
  await prisma.appStrategyRecord.deleteMany();
  idCounter = 1;
}
