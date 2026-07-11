import { prisma } from "@/lib/db";

/**
 * Authoritative instance-level settings (key/value JSON). Used for cross-cutting
 * feature toggles like dependency enforcement. Missing keys fall back to the
 * provided default so callers never have to special-case absence.
 */
export async function getInstanceSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await prisma.instanceSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return (row.value as T) ?? fallback;
}

export async function setInstanceSetting(key: string, value: unknown, updatedBy?: string): Promise<void> {
  await prisma.instanceSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedBy: updatedBy ?? null },
    update: { value: value as never, updatedBy: updatedBy ?? null },
  });
}

export type DependencyEnforcement = "off" | "warn" | "block";

export const DEFAULT_DEPENDENCY_ENFORCEMENT: DependencyEnforcement = "block";
