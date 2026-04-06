/**
 * @module sync-provider-health
 * @description Shared utility for syncing the in-process model-registry provider
 * health cache from the database.
 *
 * Both the models route and the routing route need this operation before they
 * can report accurate `getUsableModels()` results.  Keeping it in one place
 * ensures both routes use identical logic and that any future DB schema
 * changes only need to be reflected here.
 */

import { prisma } from './prisma';
import {
  getModelRegistry,
  setProviderHealth,
  type ProviderHealthStatus,
} from './model-registry';

/**
 * Syncs the in-process provider health cache from the `AiProvider` rows in
 * the database.  Providers that have an `apiKey` set are marked with their
 * current `healthStatus`; all others are marked `'unconfigured'` so that
 * `getUsableModels()` / `isProviderUsable()` return accurate results for
 * this request.
 *
 * Errors are logged but swallowed — callers fall through with whatever
 * health state was already cached (typically empty on first call, meaning
 * all providers are treated as usable, which is the safe default for a
 * cold-start with no DB).
 */
export async function syncProviderHealthFromDB(): Promise<void> {
  try {
    const dbProviders = await prisma.aiProvider.findMany({
      where: { enabled: true },
      select: { providerKey: true, healthStatus: true, apiKey: true },
    });
    const configuredKeys = new Set<string>();
    for (const p of dbProviders) {
      if (p.apiKey) {
        setProviderHealth(p.providerKey, p.healthStatus as ProviderHealthStatus);
        configuredKeys.add(p.providerKey);
      }
    }
    // Mark all other known providers as unconfigured so getUsableModels()
    // returns accurate data and does not include unconfigured providers.
    const allKeys = new Set(getModelRegistry().map((m) => m.provider));
    for (const key of Array.from(allKeys)) {
      if (!configuredKeys.has(key)) {
        setProviderHealth(key, 'unconfigured');
      }
    }
  } catch (err) {
    // Best-effort: log so operators can diagnose DB connectivity issues
    // affecting routing/model listing accuracy.
    console.warn(
      '[sync-provider-health] syncProviderHealthFromDB failed; health overlay may be stale:',
      err,
    );
  }
}
