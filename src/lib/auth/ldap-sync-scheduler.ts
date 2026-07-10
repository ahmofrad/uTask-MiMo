import { logger } from "@/lib/logging";
import { prisma } from "@/lib/db";
import { getLdapConfig, syncAllLdapGroups } from "@/lib/auth/providers/ldap";

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const config = await getLdapConfig();
    if (config?.enabled) {
      const groupCount = await prisma.ldapSyncGroup.count();
      if (groupCount > 0) {
        const result = await syncAllLdapGroups(config);
        logger.info({ ...result }, "ldap scheduled sync completed");
      }
    }
  } catch (err) {
    logger.error({ err }, "ldap scheduled sync failed");
  } finally {
    running = false;
    scheduleNext();
  }
}

function scheduleNext() {
  void (async () => {
    let hours = 12;
    try {
      const config = await getLdapConfig();
      if (config?.enabled && Number.isFinite(config.syncIntervalHours) && config.syncIntervalHours > 0) {
        hours = config.syncIntervalHours;
      }
    } catch {
      // keep the default interval
    }
    const ms = Math.max(1, hours) * 3_600_000;
    timer = setTimeout(() => void tick(), ms);
  })();
}

/**
 * Starts the recurring LDAP group sync. The first run is delayed by one minute;
 * subsequent runs are spaced by the configured `syncIntervalHours` (re-read each cycle).
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
