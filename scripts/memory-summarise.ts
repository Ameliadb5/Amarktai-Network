#!/usr/bin/env ts-node
/**
 * Memory Summarisation Job
 *
 * Periodically condenses older memory entries into summaries.
 *
 * Behaviour:
 *  1. Finds entries older than SUMMARISE_OLDER_THAN_DAYS (default 30)
 *     that have memoryType = 'event' or 'context'.
 *  2. Groups them by appSlug.
 *  3. Creates a single summary entry (memoryType = 'summary') per app
 *     containing condensed content from the batch.
 *  4. Lowers the importance of the original entries by 50 %.
 *
 * Run manually:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/memory-summarise.ts
 *
 * Or schedule via cron / serverless trigger.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUMMARISE_OLDER_THAN_DAYS = Number(process.env.SUMMARISE_DAYS ?? 30);
const BATCH_SIZE = 200;
const MIN_ENTRIES_TO_SUMMARISE = 3;

async function run() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SUMMARISE_OLDER_THAN_DAYS);

  console.log(
    `[memory-summarise] Looking for entries older than ${cutoff.toISOString()} (${SUMMARISE_OLDER_THAN_DAYS} days)`,
  );

  // Fetch older event/context entries not yet summarised
  const entries = await prisma.memoryEntry.findMany({
    where: {
      createdAt: { lt: cutoff },
      memoryType: { in: ['event', 'context'] },
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (entries.length < MIN_ENTRIES_TO_SUMMARISE) {
    console.log(
      `[memory-summarise] Only ${entries.length} entries found — skipping (need ≥ ${MIN_ENTRIES_TO_SUMMARISE}).`,
    );
    return;
  }

  // Group by appSlug
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const slug = entry.appSlug ?? 'unknown';
    const list = groups.get(slug) ?? [];
    list.push(entry);
    groups.set(slug, list);
  }

  let summarised = 0;

  for (const [appSlug, items] of groups) {
    if (items.length < MIN_ENTRIES_TO_SUMMARISE) continue;

    // Build a condensed summary from the batch
    const condensed = items
      .map(
        (e) =>
          `[${e.memoryType}] ${e.key}: ${(e.content ?? '').slice(0, 120)}`,
      )
      .join('\n');

    const summaryContent =
      `Summarised ${items.length} memory entries for app "${appSlug}" ` +
      `spanning ${items[0].createdAt.toISOString().slice(0, 10)} to ` +
      `${items[items.length - 1].createdAt.toISOString().slice(0, 10)}.\n\n` +
      condensed;

    // Create the summary entry
    await prisma.memoryEntry.create({
      data: {
        appSlug,
        memoryType: 'summary',
        key: `summary-batch-${Date.now()}`,
        content: summaryContent,
        importance: 0.7, // summaries are moderately important (0.0–1.0 scale)
        expiresAt: null, // summaries don't expire
      },
    });

    // Lower importance of the original entries by 50 %
    const ids = items.map((e) => e.id);
    const avgImportance = items.reduce((sum, e) => sum + (e.importance ?? 0.5), 0) / items.length;
    await prisma.memoryEntry.updateMany({
      where: { id: { in: ids } },
      data: {
        importance: Math.max(0.1, avgImportance * 0.5),
      },
    });

    summarised += items.length;
    console.log(
      `[memory-summarise] Created summary for "${appSlug}" (${items.length} entries).`,
    );
  }

  console.log(`[memory-summarise] Done. ${summarised} entries summarised across ${groups.size} app(s).`);
}

run()
  .catch((err) => {
    console.error('[memory-summarise] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
