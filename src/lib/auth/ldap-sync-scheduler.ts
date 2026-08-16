import { logger } from "@/lib/logging";
import { syncLdapSource } from "@/lib/auth/providers/ldap";
import { getEnabledLdapSources } from "@/lib/auth/ldap-sources";
import { withDistributedLock } from "@/lib/queue/lock";

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * Syncs a single source under its own distributed lock, but only if its own
 * `syncIntervalHours` has elapsed since its last successful sync. A source that
 * has never synced is due immediately; `lastSyncError` is surfaced (and cleared
 * on success) by `syncLdapSource` itself.
 */
async function syncSourceIfDue(sourceId: string, intervalHours: number, lastSyncedAt: Date | null) {
  if (lastSyncedAt) {
    const elapsedMs = Date.now() - lastSyncedAt.getTime();
    if (elapsedMs < intervalHours * 3_600_000) return false;
  }
  await withDistributedLock(`ldap-sync:${sourceId}`, 30 * 60_000, async () => {
    const result = await syncLdapSource(sourceId);
    logger.info({ sourceId, ...result }, "ldap scheduled sync completed");
  });
  return true;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const sources = await getEnabledLdapSources();
    // Each source runs on its own schedule and under its own lock, so a slow
    // or failing directory never blocks the others.
    for (const source of sources) {
      try {
        await syncSourceIfDue(source.id, source.syncIntervalHours, source.lastSyncedAt);
      } catch (err) {
        // syncLdapSource records lastSyncError; log and continue with the rest.
        logger.error({ err, sourceId: source.id }, "ldap scheduled sync failed");
      }
    }
  } finally {
    running = false;
    scheduleNext();
  }
}

function scheduleNext() {
  void (async () => {
    // Schedule the next pass at the soonest due source. The shortest enabled
    // interval bounds how stale a source can get when it is added or re-enabled.
    let hours = 12;
    try {
      const sources = await getEnabledLdapSources();
      if (sources.length > 0) {
        hours = Math.min(...sources.map((source) => source.syncIntervalHours));
      }
    } catch (err) {
      logger.error({ err }, "failed to read LDAP sources for scheduling; using default");
    }
    const ms = Math.max(1, hours) * 3_600_000;
    timer = setTimeout(() => void tick(), ms);
  })();
}

/**
 * Starts the recurring per-source LDAP sync. The first pass is delayed by one
 * minute; subsequent passes are spaced by the shortest enabled source's
 * `syncIntervalHours` (re-read each cycle). Each source is only actually synced
 * when its own interval has elapsed.
 */
export function startLdapSyncScheduler() {
  if (timer) return;
  timer = setTimeout(() => void tick(), 60_000);
}

export function stopLdapSyncScheduler() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
