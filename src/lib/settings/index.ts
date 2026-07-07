import { prisma } from "@/lib/db";
import type { SettingsScope } from "@prisma/client";

export async function getSettings(scope: SettingsScope, scopeId: string | null) {
  const settings = await prisma.settings.findMany({
    where: { scope, scopeId },
  });

  const map: Record<string, unknown> = {};
  for (const s of settings) {
    map[s.key] = s.valueJson;
  }

  return map;
}

export async function updateSettings(
  scope: SettingsScope,
  scopeId: string | null,
  updates: Record<string, unknown>,
) {
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(updates)) {
      if (scopeId === null) {
        // PostgreSQL: NULL != NULL in unique constraints, so upsert won't find existing rows
        const existing = await tx.settings.findFirst({ where: { scope, scopeId: null, key } });
        if (existing) {
          await tx.settings.update({ where: { id: existing.id }, data: { valueJson: value as never } });
        } else {
          await tx.settings.create({ data: { scope, scopeId: null, key, valueJson: value as never } });
        }
      } else {
        await tx.settings.upsert({
          where: { scope_scopeId_key: { scope, scopeId, key } },
          update: { valueJson: value as never },
          create: { scope, scopeId, key, valueJson: value as never },
        });
      }
    }
  });
}
