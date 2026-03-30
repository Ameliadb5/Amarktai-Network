/**
 * Cross-App Learning Engine — transfer learning across connected apps.
 *
 * When one app discovers a high-performing pattern, the system can
 * intelligently reuse that learning for other apps in similar contexts.
 *
 * Examples:
 *  - A cheaper model that performs well for a task type across apps
 *  - A content style that improves engagement
 *  - A routing choice that reduces latency without hurting quality
 *  - A better fallback path discovered under load
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossAppPattern {
  id: string;
  /** Type of insight: model performance, routing, content, cost */
  patternType: 'model_performance' | 'routing_optimization' | 'content_style' | 'cost_saving' | 'fallback_path' | 'latency_improvement';
  /** The app that discovered this pattern */
  sourceApp: string;
  /** App types this pattern is relevant to (empty = universal) */
  relevantAppTypes: string[];
  /** Capability class this pattern relates to */
  capability: string;
  /** Human-readable description */
  description: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Data supporting the pattern */
  evidence: PatternEvidence;
  /** When was this pattern discovered */
  discoveredAt: string;
  /** How many times it was applied to other apps */
  applicationCount: number;
  /** Success rate when applied to other apps */
  applicationSuccessRate: number | null;
}

export interface PatternEvidence {
  sampleSize: number;
  metric: string;
  before: number | null;
  after: number;
  improvement: number | null;
  providerKey?: string;
  model?: string;
  taskType?: string;
}

export interface CrossAppInsight {
  pattern: CrossAppPattern;
  targetApp: string;
  applicabilityScore: number;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const patternStore: CrossAppPattern[] = [];
let patternIdCounter = 0;

function nextPatternId(): string {
  return `xap_${++patternIdCounter}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Pattern recording
// ---------------------------------------------------------------------------

/**
 * Record a cross-app learning pattern discovered from outcome data.
 */
export function recordPattern(
  input: Omit<CrossAppPattern, 'id' | 'discoveredAt' | 'applicationCount' | 'applicationSuccessRate'>,
): CrossAppPattern {
  const pattern: CrossAppPattern = {
    ...input,
    id: nextPatternId(),
    discoveredAt: new Date().toISOString(),
    applicationCount: 0,
    applicationSuccessRate: null,
  };
  patternStore.push(pattern);

  // Keep store bounded
  if (patternStore.length > 500) {
    patternStore.splice(0, patternStore.length - 500);
  }

  return pattern;
}

// ---------------------------------------------------------------------------
// Pattern discovery from outcome data
// ---------------------------------------------------------------------------

/**
 * Analyze outcome data and discover cross-app patterns.
 *
 * This should be called periodically with aggregated outcome data.
 */
export function discoverPatterns(
  outcomes: Array<{
    appSlug: string;
    appType: string;
    taskType: string;
    capability: string;
    providerKey: string;
    model: string;
    success: boolean;
    latencyMs: number;
    costUsd: number;
    fallbackUsed: boolean;
  }>,
): CrossAppPattern[] {
  const discovered: CrossAppPattern[] = [];
  if (outcomes.length < 5) return discovered;

  // Group by model+taskType to find high-performing models
  const modelPerformance = new Map<string, {
    provider: string;
    model: string;
    taskType: string;
    capability: string;
    successes: number;
    total: number;
    totalLatency: number;
    totalCost: number;
    apps: Set<string>;
    appTypes: Set<string>;
  }>();

  for (const o of outcomes) {
    const key = `${o.model}::${o.taskType}`;
    let entry = modelPerformance.get(key);
    if (!entry) {
      entry = {
        provider: o.providerKey,
        model: o.model,
        taskType: o.taskType,
        capability: o.capability,
        successes: 0,
        total: 0,
        totalLatency: 0,
        totalCost: 0,
        apps: new Set(),
        appTypes: new Set(),
      };
      modelPerformance.set(key, entry);
    }
    entry.total++;
    if (o.success) entry.successes++;
    entry.totalLatency += o.latencyMs;
    entry.totalCost += o.costUsd;
    entry.apps.add(o.appSlug);
    entry.appTypes.add(o.appType);
  }

  // Find models that perform well across multiple apps
  Array.from(modelPerformance.values()).forEach((entry) => {
    if (entry.total < 5 || entry.apps.size < 1) return;
    const successRate = entry.successes / entry.total;
    const avgLatency = entry.totalLatency / entry.total;
    const avgCost = entry.totalCost / entry.total;

    if (successRate >= 0.9) {
      const pattern = recordPattern({
        patternType: 'model_performance',
        sourceApp: Array.from(entry.apps)[0],
        relevantAppTypes: Array.from(entry.appTypes),
        capability: entry.capability,
        description: `Model ${entry.model} achieves ${(successRate * 100).toFixed(0)}% success rate for ${entry.taskType} tasks across ${entry.apps.size} app(s) at avg cost $${avgCost.toFixed(4)}/task.`,
        confidence: Math.min(0.95, successRate * (entry.total / 50)),
        evidence: {
          sampleSize: entry.total,
          metric: 'success_rate',
          before: null,
          after: successRate,
          improvement: null,
          providerKey: entry.provider,
          model: entry.model,
          taskType: entry.taskType,
        },
      });
      discovered.push(pattern);
    }

    // Discover cost-saving patterns (cheap + high success)
    if (successRate >= 0.85 && avgCost < 0.005) {
      const pattern = recordPattern({
        patternType: 'cost_saving',
        sourceApp: Array.from(entry.apps)[0],
        relevantAppTypes: Array.from(entry.appTypes),
        capability: entry.capability,
        description: `Model ${entry.model} is cost-effective for ${entry.taskType}: ${(successRate * 100).toFixed(0)}% success at $${avgCost.toFixed(4)}/task avg.`,
        confidence: Math.min(0.9, successRate * 0.9),
        evidence: {
          sampleSize: entry.total,
          metric: 'cost_per_task',
          before: null,
          after: avgCost,
          improvement: null,
          providerKey: entry.provider,
          model: entry.model,
          taskType: entry.taskType,
        },
      });
      discovered.push(pattern);
    }

    // Discover latency improvements
    if (avgLatency < 500 && successRate >= 0.85) {
      const pattern = recordPattern({
        patternType: 'latency_improvement',
        sourceApp: Array.from(entry.apps)[0],
        relevantAppTypes: Array.from(entry.appTypes),
        capability: entry.capability,
        description: `Model ${entry.model} achieves low latency (${avgLatency.toFixed(0)}ms avg) for ${entry.taskType} with ${(successRate * 100).toFixed(0)}% success.`,
        confidence: Math.min(0.85, successRate * 0.85),
        evidence: {
          sampleSize: entry.total,
          metric: 'latency_ms',
          before: null,
          after: avgLatency,
          improvement: null,
          providerKey: entry.provider,
          model: entry.model,
          taskType: entry.taskType,
        },
      });
      discovered.push(pattern);
    }
  });

  // Discover fallback path patterns
  const fallbackOutcomes = outcomes.filter((o) => o.fallbackUsed);
  if (fallbackOutcomes.length >= 3) {
    const fallbackSuccessRate =
      fallbackOutcomes.filter((o) => o.success).length / fallbackOutcomes.length;
    if (fallbackSuccessRate >= 0.8) {
      const providers = new Set(fallbackOutcomes.map((o) => o.providerKey));
      const pattern = recordPattern({
        patternType: 'fallback_path',
        sourceApp: fallbackOutcomes[0].appSlug,
        relevantAppTypes: [],
        capability: 'general',
        description: `Fallback path through ${Array.from(providers).join(', ')} achieves ${(fallbackSuccessRate * 100).toFixed(0)}% success across ${fallbackOutcomes.length} fallback events.`,
        confidence: Math.min(0.8, fallbackSuccessRate * 0.8),
        evidence: {
          sampleSize: fallbackOutcomes.length,
          metric: 'fallback_success_rate',
          before: null,
          after: fallbackSuccessRate,
          improvement: null,
        },
      });
      discovered.push(pattern);
    }
  }

  return discovered;
}

// ---------------------------------------------------------------------------
// Pattern application
// ---------------------------------------------------------------------------

/**
 * Get patterns applicable to a target app, sorted by relevance.
 */
export function getApplicablePatterns(
  targetAppSlug: string,
  targetAppType: string,
): CrossAppInsight[] {
  const insights: CrossAppInsight[] = [];

  for (const pattern of patternStore) {
    // Don't recommend patterns from the same app
    if (pattern.sourceApp === targetAppSlug) continue;

    // Calculate applicability
    let score = pattern.confidence;

    // Boost if app type is relevant
    if (
      pattern.relevantAppTypes.length === 0 ||
      pattern.relevantAppTypes.includes(targetAppType)
    ) {
      score *= 1.0;
    } else {
      score *= 0.5; // Still potentially useful, but lower confidence
    }

    // Boost if pattern has been successfully applied elsewhere
    if (
      pattern.applicationSuccessRate !== null &&
      pattern.applicationSuccessRate > 0.8
    ) {
      score *= 1.1;
    }

    if (score < 0.3) continue; // Too low confidence

    let recommendation = '';
    switch (pattern.patternType) {
      case 'model_performance':
        recommendation = `Consider using ${pattern.evidence.model} for ${pattern.evidence.taskType ?? 'similar'} tasks based on cross-app performance data.`;
        break;
      case 'cost_saving':
        recommendation = `Switch to ${pattern.evidence.model} for ${pattern.evidence.taskType ?? 'this'} capability to reduce costs while maintaining quality.`;
        break;
      case 'latency_improvement':
        recommendation = `Route ${pattern.evidence.taskType ?? 'these'} tasks through ${pattern.evidence.model} for faster response times.`;
        break;
      case 'fallback_path':
        recommendation = `Configure a fallback path similar to what works for ${pattern.sourceApp}.`;
        break;
      default:
        recommendation = pattern.description;
    }

    insights.push({
      pattern,
      targetApp: targetAppSlug,
      applicabilityScore: Math.min(1, score),
      recommendation,
    });
  }

  // Sort by applicability
  insights.sort((a, b) => b.applicabilityScore - a.applicabilityScore);
  return insights.slice(0, 20);
}

/**
 * Record that a pattern was applied to an app and whether it succeeded.
 */
export function recordPatternApplication(
  patternId: string,
  success: boolean,
): boolean {
  const pattern = patternStore.find((p) => p.id === patternId);
  if (!pattern) return false;

  pattern.applicationCount++;
  if (pattern.applicationSuccessRate === null) {
    pattern.applicationSuccessRate = success ? 1 : 0;
  } else {
    // Running average
    const total = pattern.applicationCount;
    pattern.applicationSuccessRate =
      (pattern.applicationSuccessRate * (total - 1) + (success ? 1 : 0)) / total;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Status and summary
// ---------------------------------------------------------------------------

export function getCrossAppLearningStatus(): {
  totalPatterns: number;
  patternsByType: Record<string, number>;
  totalApplications: number;
  avgApplicationSuccess: number | null;
} {
  const patternsByType: Record<string, number> = {};
  let totalApplications = 0;
  let successSum = 0;
  let successCount = 0;

  for (const p of patternStore) {
    patternsByType[p.patternType] = (patternsByType[p.patternType] ?? 0) + 1;
    totalApplications += p.applicationCount;
    if (p.applicationSuccessRate !== null) {
      successSum += p.applicationSuccessRate;
      successCount++;
    }
  }

  return {
    totalPatterns: patternStore.length,
    patternsByType,
    totalApplications,
    avgApplicationSuccess: successCount > 0 ? successSum / successCount : null,
  };
}

export function getAllPatterns(): CrossAppPattern[] {
  return [...patternStore];
}

/**
 * Reset all patterns (for testing).
 */
export function resetPatterns(): void {
  patternStore.length = 0;
  patternIdCounter = 0;
}
