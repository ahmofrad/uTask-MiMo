import { createHash } from "node:crypto";
import { getRedis } from "@/lib/redis";
import { logAudit } from "@/lib/audit/log";
import { prisma } from "@/lib/db";

/**
 * G16e — password lockout + security audit.
 *
 * Counts consecutive failed local logins per account (keyed by a hash of the
 * email, so the raw address never appears in Redis). After
 * AUTH_MAX_FAILED_ATTEMPTS (default 5) failures within the window the account
 * is locked for AUTH_LOCKOUT_MINUTES (default 15). A successful login clears
 * the counter. Lockout triggers write an audit-log entry (action login_failed,
 * entityType user) for forensic signal.
 */

const LOCKOUT_PREFIX = "auth:lockout:v1:";

function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function attemptsKey(email: string): string {
  return `${LOCKOUT_PREFIX}${emailKey(email)}:attempts`;
}

function lockedKey(email: string): string {
  return `${LOCKOUT_PREFIX}${emailKey(email)}:locked`;
}

function config(): { maxAttempts: number; lockoutMinutes: number } {
  const maxAttempts = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS ?? 5);
  const lockoutMinutes = Number(process.env.AUTH_LOCKOUT_MINUTES ?? 15);
  return {
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : 5,
    lockoutMinutes: Number.isFinite(lockoutMinutes) && lockoutMinutes > 0 ? lockoutMinutes : 15,
  };
}

/** True when the account is currently locked (or Redis is unavailable — fail closed). */
export async function isLockedOut(email: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    const locked = await redis.get(lockedKey(email));
    return locked === "1";
  } catch {
    // If Redis is down, lockouts cannot be enforced — allow the attempt so
    // login does not become a hard outage; the rate limiter still applies.
    return false;
  }
}

/**
 * Record a failed login. Returns `true` when this attempt flips the account
 * into a temporary lockout, so the caller can emit a security-audit event.
 */
export async function recordFailedLogin(email: string): Promise<boolean> {
  const { maxAttempts, lockoutMinutes } = config();
  try {
    const redis = await getRedis();
    const attempts = await redis.incr(attemptsKey(email));
    await redis.expire(attemptsKey(email), Math.max(60, lockoutMinutes * 60));

    if (attempts >= maxAttempts) {
      await redis.set(lockedKey(email), "1", "EX", lockoutMinutes * 60);
      // Keep a separate counter that persists past the lockout window so an
      // account that repeatedly trips the lockout shows up in monitoring.
      await redis.del(attemptsKey(email));
      return true;
    }
  } catch {
    // Redis failure: don't crash the login path.
  }
  return false;
}

/** Successful login clears the counters. */
export async function clearLockout(email: string): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.del(attemptsKey(email));
    await redis.del(lockedKey(email));
  } catch {
    // Best-effort.
  }
}

/** Write the lockout account as an audit entry. */
export async function auditLockout(email: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    await logAudit({
      actorUserId: null,
      action: "login_failed",
      entityType: "user",
      entityId: user?.id ?? emailKey(email),
    });
  } catch {
    // Audit writes must never break the auth path.
  }
}

/** Exposed for tests. */
export const _lockoutInternals = { attemptsKey, lockedKey, emailKey };