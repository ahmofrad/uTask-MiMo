import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Bring the local dev database in line with `schema.prisma` and record the
 * migration history so `prisma migrate deploy` becomes a no-op.
 *
 * The dev DB is managed with `prisma db push` (not `migrate dev`), which leaves
 * `_prisma_migrations` empty. A fresh `migrate deploy` would then try to re-apply
 * every migration onto already-present tables and fail. This script:
 *
 *   1. Creates the Postgres extensions `schema.prisma` relies on (normally done
 *      by the `01_init` migration, which `db push` skips).
 *   2. Syncs the schema via `prisma db push` (idempotent).
 *   3. Marks any not-yet-recorded migrations as applied via `migrate resolve`
 *      WITHOUT executing their SQL (the schema is already in place).
 *
 * Safe to run repeatedly: extensions and already-applied migrations are skipped.
 */
const migrationsDir = path.resolve("prisma/migrations");

// Mirrors the extensions created by `01_init/migration.sql`.
const EXTENSIONS = ["citext", "pg_trgm", "pgcrypto"];

function migrationNames(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => name !== "migration_lock.toml")
    .sort();
}

async function appliedNames(prisma: PrismaClient): Promise<Set<string>> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
      'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL',
    );
    return new Set(rows.map((r) => r.migration_name));
  } catch {
    // `_prisma_migrations` does not exist yet — nothing is recorded.
    return new Set();
  }
}

async function ensureExtensions(prisma: PrismaClient): Promise<void> {
  for (const ext of EXTENSIONS) {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("🧩 Ensuring Postgres extensions…");
    await ensureExtensions(prisma);

    console.log("🔧 Syncing schema with `prisma db push`…");
    execSync("npx --no-install prisma db push", { stdio: "inherit" });

    const applied = await appliedNames(prisma);
    const pending = migrationNames().filter((name) => !applied.has(name));

    if (pending.length === 0) {
      console.log("✅ Migration history already up to date — nothing to baseline.");
      return;
    }

    console.log(`📝 Recording ${pending.length} migration(s) as applied…`);
    for (const name of pending) {
      execSync(`npx --no-install prisma migrate resolve --applied "${name}"`, {
        stdio: "inherit",
      });
    }
    console.log("✅ Baseline complete — `prisma migrate deploy` is now a no-op.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
