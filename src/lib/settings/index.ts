import { prisma } from "@/lib/db";
import type { SettingsScope } from "@prisma/client";

export async function getSettings(scope: SettingsScope, scopeId: string) {
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
  scopeId: string,
  updates: Record<string, unknown>,
) {
  const ops = Object.entries(updates).map(([key, value]) =>
    prisma.settings.upsert({
      where: { scope_scopeId_key: { scope, scopeId, key } },
      update: { valueJson: value as never },
      create: { scope, scopeId, key, valueJson: value as never },
    }),
  );

  await prisma.$transaction(ops);
}
