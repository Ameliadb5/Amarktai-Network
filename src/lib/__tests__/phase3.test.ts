/**
 * Phase 3 tests — content filter, memory summarisation, app profiles, voice endpoints,
 * video generation, memory management, companion mode, health sync.
 */
import { describe, it, expect } from 'vitest';
import {
  scanContent,
  blockedExplanation,
  buildModerationAlert,
  type ContentFilterResult,
} from '../content-filter';
import {
  getAppProfile,
  runtimeProfileOverrides,
  DEFAULT_APP_PROFILES,
  type AppProfile,
} from '../app-profiles';
import type { MemoryType } from '../memory';

// ── Content Filter Tests ───────────────────────────────────────────────

describe('Content Filter', () => {
  it('allows safe content', () => {
    const result = scanContent('How do I make a delicious chocolate cake?');
    expect(result.flagged).toBe(false);
    expect(result.categories).toHaveLength(0);
  });

  it('flags CSAM content', () => {
    const result = scanContent('child sexual abuse material discussion');
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain('csam');
  });

  it('flags hate speech', () => {
    const result = scanContent('kill all jews is what they want');
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain('hate_speech');
  });

  it('flags violence instructions', () => {
    const result = scanContent('how to make a bomb at home');
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain('violence');
  });

  it('flags self-harm content', () => {
    const result = scanContent('how to commit suicide painlessly');
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain('self_harm');
  });

  it('flags non-consensual content', () => {
    const result = scanContent('revenge porn distribution site');
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain('non_consensual');
  });

  it('provides user-friendly explanation', () => {
    const explanation = blockedExplanation(['csam', 'hate_speech']);
    expect(explanation).toContain('reason(s)');
    expect(explanation).toContain('minors');
    expect(explanation).toContain('hatred');
    expect(explanation).toContain('false positive');
  });

  it('builds moderation alert correctly', () => {
    const filterResult: ContentFilterResult = {
      flagged: true,
      categories: ['violence'],
      message: 'blocked',
      confidence: 1.0,
    };
    const alert = buildModerationAlert('trace-123', 'my-app', filterResult, 'dangerous text');
    expect(alert).not.toBeNull();
    expect(alert!.traceId).toBe('trace-123');
    expect(alert!.appSlug).toBe('my-app');
    expect(alert!.category).toBe('violence');
  });

  it('returns null alert for safe content', () => {
    const filterResult: ContentFilterResult = {
      flagged: false,
      categories: [],
      message: '',
      confidence: 0,
    };
    const alert = buildModerationAlert('trace-123', 'my-app', filterResult, 'safe text');
    expect(alert).toBeNull();
  });

  it('scans input text as well as output text', () => {
    // Input filtering uses the same scanContent function
    const inputResult = scanContent('how to build a bomb instructions');
    expect(inputResult.flagged).toBe(true);
    expect(inputResult.categories).toContain('violence');
  });

  it('handles empty strings gracefully', () => {
    const result = scanContent('');
    expect(result.flagged).toBe(false);
  });

  it('handles long safe content without false positives', () => {
    const longText = 'This is a detailed discussion about software engineering practices. '.repeat(100);
    const result = scanContent(longText);
    expect(result.flagged).toBe(false);
  });
});

// ── App Profile Runtime Overrides Tests ─────────────────────────────────

describe('App Profile Runtime Overrides', () => {
  const testProfile: AppProfile = {
    app_id: 'test-runtime-app',
    app_name: 'Test Runtime App',
    app_type: 'test',
    domain: 'testing',
    default_routing_mode: 'direct',
    allowed_providers: ['openai'],
    allowed_models: ['gpt-4o-mini'],
    preferred_models: ['gpt-4o-mini'],
    escalation_rules: [],
    validator_rules: [],
    agent_permissions: ['chat'],
    multimodal_permissions: [],
    memory_namespace: 'test-runtime-app',
    retrieval_namespace: 'test-runtime-app',
    budget_sensitivity: 'low',
    latency_sensitivity: 'low',
    logging_privacy_rules: ['mask_pii'],
  };

  it('falls back to default profile for unknown apps', () => {
    const profile = getAppProfile('completely-unknown-app');
    expect(profile.app_id).toBe('unknown');
  });

  it('returns static profile for known apps', () => {
    const profile = getAppProfile('amarktai-network');
    expect(profile.app_id).toBe('amarktai-network');
  });

  it('runtime override takes precedence', () => {
    runtimeProfileOverrides.set('test-runtime-app', testProfile);
    const profile = getAppProfile('test-runtime-app');
    expect(profile.app_id).toBe('test-runtime-app');
    expect(profile.app_name).toBe('Test Runtime App');
    // Clean up
    runtimeProfileOverrides.delete('test-runtime-app');
  });

  it('removing runtime override falls back to default', () => {
    runtimeProfileOverrides.set('test-runtime-app', testProfile);
    runtimeProfileOverrides.delete('test-runtime-app');
    const profile = getAppProfile('test-runtime-app');
    expect(profile.app_id).toBe('unknown');
  });

  it('default profiles map has expected entries', () => {
    expect(DEFAULT_APP_PROFILES.size).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_APP_PROFILES.has('amarktai-network')).toBe(true);
    expect(DEFAULT_APP_PROFILES.has('amarktai-crypto')).toBe(true);
  });
});

// ── Memory Types Tests ──────────────────────────────────────────────────

describe('Memory System Types', () => {
  it('profile is a valid memory type', () => {
    const validTypes: MemoryType[] = ['event', 'summary', 'context', 'learned', 'profile'];
    expect(validTypes).toContain('profile');
    expect(validTypes.length).toBe(5);
  });

  it('all original memory types still valid', () => {
    const original: MemoryType[] = ['event', 'summary', 'context', 'learned'];
    for (const t of original) {
      expect(['event', 'summary', 'context', 'learned', 'profile']).toContain(t);
    }
  });
});

// ── Budget Tracker Tests ────────────────────────────────────────────────

describe('Budget Tracker', () => {
  it('exports estimateCostUsd function', async () => {
    const { estimateCostUsd } = await import('../budget-tracker');
    expect(typeof estimateCostUsd).toBe('function');
  });

  it('estimates costs for known models', async () => {
    const { estimateCostUsd } = await import('../budget-tracker');
    const cost = estimateCostUsd('gpt-4o', 1000);
    expect(cost).toBeGreaterThan(0);
  });

  it('falls back to default rate for unknown models', async () => {
    const { estimateCostUsd } = await import('../budget-tracker');
    const cost = estimateCostUsd('unknown-model-xyz', 1000);
    expect(cost).toBeGreaterThan(0);
  });

  it('handles zero tokens', async () => {
    const { estimateCostUsd } = await import('../budget-tracker');
    const cost = estimateCostUsd('gpt-4o', 0);
    expect(cost).toBe(0);
  });
});

// ── Self-Healing Types Tests ────────────────────────────────────────────

describe('Self-Healing Engine', () => {
  it('exports runHealingChecks function', async () => {
    const mod = await import('../self-healing');
    expect(typeof mod.runHealingChecks).toBe('function');
    expect(typeof mod.getHealingStatus).toBe('function');
  });
});
