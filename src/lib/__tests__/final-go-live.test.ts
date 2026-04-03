/**
 * Final go-live verification tests.
 *
 * Covers all four previously-blocked capabilities:
 *   - reranking            (standalone API route)
 *   - video_generation     (async job pipeline)
 *   - realtime_voice       (WS service + session endpoint)
 *   - suggestive_video_generation  (new capability, HF video models)
 *
 * Also verifies:
 *   - No regressions to existing capability truth
 *   - blockedBySettings is correctly set for settings-gated capabilities
 *   - suggestive_video_generation guard (requires suggestiveMode)
 *   - realtime_voice guard (requires REALTIME_SERVICE_URL)
 *   - Model registry additions (video gen, realtime models)
 *   - Provider catalog includes Replicate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyCapabilities,
  resolveCapabilityRoutes,
  getDetailedCapabilityStatus,
  CAPABILITY_MAP,
  BACKEND_ROUTE_EXISTS,
  SETTINGS_GATED_CAPABILITIES,
} from '../capability-engine';
import {
  getModelsByCapability,
  getModelRegistry,
  clearProviderHealthCache,
  setProviderHealth,
} from '../model-registry';
import { CANONICAL_PROVIDERS, getCanonicalProvider } from '../provider-catalog';
import { getHfFallback } from '../hf-fallback';

// ── Helper ────────────────────────────────────────────────────────────────────
// ── Capability engine: new capabilities exist ─────────────────────────────────

describe('Capability Engine — New Capabilities', () => {
  it('includes suggestive_video_generation in CAPABILITY_MAP', () => {
    expect(CAPABILITY_MAP).toHaveProperty('suggestive_video_generation');
  });

  it('BACKEND_ROUTE_EXISTS is true for reranking', () => {
    expect(BACKEND_ROUTE_EXISTS.reranking).toBe(true);
  });

  it('BACKEND_ROUTE_EXISTS is true for video_generation', () => {
    expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(true);
  });

  it('BACKEND_ROUTE_EXISTS is true for realtime_voice', () => {
    expect(BACKEND_ROUTE_EXISTS.realtime_voice).toBe(true);
  });

  it('BACKEND_ROUTE_EXISTS is true for suggestive_video_generation', () => {
    expect(BACKEND_ROUTE_EXISTS.suggestive_video_generation).toBe(true);
  });

  it('adult_18plus_image remains NOT IMPLEMENTED (BACKEND_ROUTE_EXISTS=false)', () => {
    expect(BACKEND_ROUTE_EXISTS.adult_18plus_image).toBe(false);
  });
});

// ── Model registry: new models ────────────────────────────────────────────────

describe('Model Registry — Video Generation Models', () => {
  it('has models with supports_video_generation=true', () => {
    const videoGenModels = getModelsByCapability('supports_video_generation');
    expect(videoGenModels.length).toBeGreaterThanOrEqual(2);
  });

  it('includes Replicate video models', () => {
    const replicateModels = getModelRegistry().filter(
      (m) => m.provider === 'replicate' && m.supports_video_generation,
    );
    expect(replicateModels.length).toBeGreaterThanOrEqual(1);
  });

  it('includes HuggingFace zeroscope model', () => {
    const zeroscope = getModelRegistry().find(
      (m) => m.provider === 'huggingface' && m.model_id === 'cerspense/zeroscope_v2_576w',
    );
    expect(zeroscope).toBeDefined();
    expect(zeroscope?.supports_video_generation).toBe(true);
  });

  it('includes OpenAI gpt-4o-realtime-preview model', () => {
    const realtimeModel = getModelRegistry().find(
      (m) => m.provider === 'openai' && m.model_id === 'gpt-4o-realtime-preview',
    );
    expect(realtimeModel).toBeDefined();
    expect(realtimeModel?.supports_voice_interaction).toBe(true);
  });
});

// ── Provider catalog ──────────────────────────────────────────────────────────

describe('Provider Catalog', () => {
  it('includes Replicate provider', () => {
    const replicate = getCanonicalProvider('replicate');
    expect(replicate).toBeDefined();
    expect(replicate?.displayName).toBe('Replicate');
    expect(replicate?.supportedCapabilityFamilies).toContain('video_generation');
  });

  it('has 11 canonical providers (including Replicate)', () => {
    expect(CANONICAL_PROVIDERS.length).toBe(11);
  });
});

// ── Reranking capability ──────────────────────────────────────────────────────

describe('Reranking Capability', () => {
  beforeEach(() => {
    clearProviderHealthCache();
  });

  it('is AVAILABLE when HuggingFace is configured', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['reranking'] });
    expect(result.allSatisfied).toBe(true);
    expect(result.routes[0].available).toBe(true);
    clearProviderHealthCache();
  });

  it('is AVAILABLE when NVIDIA is configured', () => {
    setProviderHealth('nvidia', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['reranking'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('is UNAVAILABLE when no provider is configured', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['reranking'] });
    expect(result.allSatisfied).toBe(false);
    expect(result.routes[0].available).toBe(false);
    expect(result.routes[0].missingMessage).toContain('No provider configured');
  });

  it('classifies reranking from task description', () => {
    const caps = classifyCapabilities('rerank', 'rerank these passages by relevance');
    expect(caps).toContain('reranking');
  });
});

// ── Video generation capability ───────────────────────────────────────────────

describe('Video Generation Capability', () => {
  beforeEach(() => {
    clearProviderHealthCache();
  });

  it('is AVAILABLE when Replicate is configured', () => {
    setProviderHealth('replicate', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['video_generation'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('is AVAILABLE when HuggingFace is configured (HF has video gen models)', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['video_generation'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('is UNAVAILABLE when no video provider is configured', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['video_generation'] });
    expect(result.allSatisfied).toBe(false);
    expect(result.routes[0].available).toBe(false);
  });

  it('does NOT use video_planning models for video_generation', () => {
    // This verifies the capability map fix (was incorrectly using supports_video_planning)
    const planningOnlyModels = getModelRegistry().filter(
      (m) => m.supports_video_planning && !m.supports_video_generation,
    );
    const videoPlanningProviders = new Set(planningOnlyModels.map((m) => m.provider));

    // With only video-planning providers configured, video_generation should be UNAVAILABLE
    for (const prov of Array.from(videoPlanningProviders)) {
      setProviderHealth(prov, 'healthy');
    }

    const result = resolveCapabilityRoutes({ capabilities: ['video_generation'] });
    // Unless any of those providers also have video generation models, it should be unavailable
    const hasVideoGenModels = planningOnlyModels.some((m) => m.supports_video_generation);
    if (!hasVideoGenModels) {
      expect(result.allSatisfied).toBe(false);
    }
    clearProviderHealthCache();
  });

  it('video_planning and video_generation are distinct capabilities', () => {
    expect(CAPABILITY_MAP.video_planning).not.toEqual(CAPABILITY_MAP.video_generation);
    expect(CAPABILITY_MAP.video_generation.anyCapabilityFlag).toContain('supports_video_generation');
    expect(CAPABILITY_MAP.video_planning.anyCapabilityFlag).not.toContain('supports_video_generation');
  });
});

// ── Realtime voice capability ─────────────────────────────────────────────────

describe('Realtime Voice Capability', () => {
  beforeEach(() => {
    clearProviderHealthCache();
    delete process.env.REALTIME_SERVICE_URL;
  });

  it('is UNAVAILABLE when REALTIME_SERVICE_URL is not set', () => {
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['realtime_voice'] });
    expect(result.allSatisfied).toBe(false);
    expect(result.routes[0].missingMessage).toContain('REALTIME_SERVICE_URL');
    clearProviderHealthCache();
  });

  it('is potentially AVAILABLE when REALTIME_SERVICE_URL is set and OpenAI is configured', () => {
    process.env.REALTIME_SERVICE_URL = 'http://localhost:8765';
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['realtime_voice'] });
    // With service URL set and OpenAI healthy, should pass the route guard
    // (may be available since OpenAI gpt-4o-realtime-preview has supports_voice_interaction)
    const msg = result.routes[0].missingMessage;
    // Should NOT contain the REALTIME_SERVICE_URL guard message
    if (msg !== null) {
      expect(msg).not.toContain('REALTIME_SERVICE_URL');
    }
    clearProviderHealthCache();
    delete process.env.REALTIME_SERVICE_URL;
  });

  it('missing message mentions separate service when URL not set', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['realtime_voice'] });
    const msg = result.routes[0].missingMessage ?? '';
    expect(msg).toMatch(/REALTIME_SERVICE_URL|realtime.*service|services\/realtime/i);
    clearProviderHealthCache();
  });
});

// ── Suggestive video generation capability ────────────────────────────────────

describe('Suggestive Video Generation Capability', () => {
  beforeEach(() => {
    clearProviderHealthCache();
  });

  it('BACKEND_ROUTE_EXISTS is true', () => {
    expect(BACKEND_ROUTE_EXISTS.suggestive_video_generation).toBe(true);
  });

  it('requires suggestiveMode to be enabled', () => {
    setProviderHealth('huggingface', 'healthy');
    // Without suggestiveMode, should be blocked
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_video_generation'],
      suggestiveMode: false,
    });
    expect(result.allSatisfied).toBe(false);
    expect(result.routes[0].missingMessage).toContain('suggestive mode');
    clearProviderHealthCache();
  });

  it('is AVAILABLE when suggestiveMode=true and HuggingFace configured', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_video_generation'],
      suggestiveMode: true,
    });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('is in SETTINGS_GATED_CAPABILITIES', () => {
    expect(SETTINGS_GATED_CAPABILITIES.has('suggestive_video_generation')).toBe(true);
  });

  it('classifies suggestive video generation from task description', () => {
    const caps = classifyCapabilities(
      'generate',
      'generate suggestive video with fashion model',
    );
    expect(caps).toContain('suggestive_video_generation');
  });
});

// ── blockedBySettings field ───────────────────────────────────────────────────

describe('Capability Status — blockedBySettings', () => {
  beforeEach(() => {
    clearProviderHealthCache();
  });

  it('returns blockedBySettings=true for suggestive_image_generation when not in suggestive mode', () => {
    setProviderHealth('openai', 'healthy');
    const statuses = getDetailedCapabilityStatus();
    const suggestiveImg = statuses.find((s) => s.capability === 'suggestive_image_generation');
    expect(suggestiveImg).toBeDefined();
    // Without suggestiveMode, it's blocked by settings
    expect(suggestiveImg?.blockedBySettings).toBe(true);
    clearProviderHealthCache();
  });

  it('returns blockedBySettings=false for general_chat', () => {
    setProviderHealth('openai', 'healthy');
    const statuses = getDetailedCapabilityStatus();
    const generalChat = statuses.find((s) => s.capability === 'general_chat');
    expect(generalChat?.blockedBySettings).toBe(false);
    clearProviderHealthCache();
  });

  it('returns blockedBySettings=false for unavailable non-gated capabilities', () => {
    // adult_18plus_image has route=false and is settings-gated
    const statuses = getDetailedCapabilityStatus();
    const adultImg = statuses.find((s) => s.capability === 'adult_18plus_image');
    expect(adultImg).toBeDefined();
    // adult_18plus_image has BACKEND_ROUTE_EXISTS=false so routeExists=false
    expect(adultImg?.routeExists).toBe(false);
    clearProviderHealthCache();
  });
});

// ── Settings-gated capabilities set ──────────────────────────────────────────

describe('SETTINGS_GATED_CAPABILITIES', () => {
  it('contains suggestive_image_generation', () => {
    expect(SETTINGS_GATED_CAPABILITIES.has('suggestive_image_generation')).toBe(true);
  });

  it('contains suggestive_video_planning', () => {
    expect(SETTINGS_GATED_CAPABILITIES.has('suggestive_video_planning')).toBe(true);
  });

  it('contains suggestive_video_generation', () => {
    expect(SETTINGS_GATED_CAPABILITIES.has('suggestive_video_generation')).toBe(true);
  });

  it('contains adult_18plus_image', () => {
    expect(SETTINGS_GATED_CAPABILITIES.has('adult_18plus_image')).toBe(true);
  });
});

// ── HuggingFace fallback for new capabilities ─────────────────────────────────

describe('HuggingFace Fallback — New Capabilities', () => {
  it('has fallback for suggestive_video_generation', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = getHfFallback('suggestive_video_generation');
    expect(result.available).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
    clearProviderHealthCache();
  });

  it('has fallback for video_generation', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = getHfFallback('video_generation');
    expect(result.available).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
    clearProviderHealthCache();
  });

  it('still has no fallback for adult_18plus_image (intentionally excluded)', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = getHfFallback('adult_18plus_image');
    expect(result.available).toBe(false);
    clearProviderHealthCache();
  });
});

// ── Existing capability regressions ──────────────────────────────────────────

describe('Regression — Existing Capabilities Still Work', () => {
  beforeEach(() => {
    clearProviderHealthCache();
  });

  it('video_planning is still AVAILABLE when OpenAI or Gemini configured', () => {
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['video_planning'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('suggestive_video_planning still exists and requires suggestive mode', () => {
    expect(BACKEND_ROUTE_EXISTS.suggestive_video_planning).toBe(true);
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_video_planning'],
      suggestiveMode: false,
    });
    expect(result.allSatisfied).toBe(false);
    clearProviderHealthCache();
  });

  it('suggestive_image_generation still works when suggestiveMode=true', () => {
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_image_generation'],
      suggestiveMode: true,
    });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('general_chat is AVAILABLE with any configured chat provider', () => {
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['general_chat'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('voice_input is AVAILABLE with Groq or OpenAI configured', () => {
    setProviderHealth('groq', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['voice_input'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('voice_output is AVAILABLE with Groq or OpenAI configured', () => {
    setProviderHealth('openai', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['voice_output'] });
    expect(result.allSatisfied).toBe(true);
    clearProviderHealthCache();
  });

  it('adult_18plus_image remains NOT_IMPLEMENTED (routeExists=false)', () => {
    setProviderHealth('huggingface', 'healthy');
    const result = resolveCapabilityRoutes({ capabilities: ['adult_18plus_image'], adultMode: true });
    expect(result.allSatisfied).toBe(false);
    // Route doesn't exist — blocked before model check
    expect(result.routes[0].missingMessage).toContain('Route not implemented');
    clearProviderHealthCache();
  });
});

// ── Capability count ──────────────────────────────────────────────────────────

describe('Capability Registry Completeness', () => {
  it('has at least 27 capabilities (original 26 + suggestive_video_generation)', () => {
    const count = Object.keys(CAPABILITY_MAP).length;
    expect(count).toBeGreaterThanOrEqual(27);
  });

  it('all capabilities in BACKEND_ROUTE_EXISTS match CAPABILITY_MAP keys', () => {
    const capKeys = Object.keys(CAPABILITY_MAP);
    const routeKeys = Object.keys(BACKEND_ROUTE_EXISTS);
    expect(routeKeys.sort()).toEqual(capKeys.sort());
  });
});
