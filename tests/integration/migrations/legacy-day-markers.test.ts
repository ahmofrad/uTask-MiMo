import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

/**
 * Integration coverage for the legacy Tehran-midnight day-marker normalization
 * migration: `20:30:00.000Z` starts/ends and `20:29:59.xZ` dues (Asia/Tehran
 * local midnights in UTC+03:30) are shifted +03:30 into canonical UTC markers,
 * while genuine instants are left untouched. Runs the exact UPDATEs from the
 * migration file against scratch tasks on the live database.
 */
maybe("legacy Tehran day-marker normalization migration", () => {
  const suffix = `${Date.now()}`;
  const projectId = "00000000-0000-4000-8000-000000000012";
  let creatorId = "";
  const legacyStart = new Date("2026-08-26T20:30:00.000Z");
  const legacyEnd = new Date("2026-08-28T20:30:00.000Z");
  const legacyDue = new Date("2026-08-28T20:29:59.999Z");
  const genuineDue = new Date("2026-08-23T07:13:18.490Z");

  let legacyTaskId = "";
  let genuineTaskId = "";

  function migrationUpdates(): string[] {
    const sql = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20260819000000_normalize_legacy_tehran_day_markers/migration.sql"),
      "utf8",
    );
    // Strip comments; split the three UPDATE statements (executeRawUnsafe runs
    // a single statement, so run each UPDATE separately — same as Prisma does
    // when applying the real migration).
    return sql
      .replace(/^--.*$/gm, "")
      .split("UPDATE")
      .filter((part) => part.trim().length > 0)
      .map((part) => `UPDATE${part.trim()}`);
  }

  async function runMigration() {
    for (const statement of migrationUpdates()) {
      await prisma.$executeRawUnsafe(statement);
    }
  }

  beforeAll(async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    creatorId = user.id;
    const [legacyTask, genuineTask] = await Promise.all([
      prisma.task.create({
        data: {
          projectId,
          title: `Legacy markers ${suffix}`,
          createdById: creatorId,
          reporterId: creatorId,
          startDate: legacyStart,
          endDate: legacyEnd,
          dueDate: legacyDue,
        },
      }),
      prisma.task.create({
        data: {
          projectId,
          title: `Genuine instant ${suffix}`,
          createdById: creatorId,
          reporterId: creatorId,
          dueDate: genuineDue,
        },
      }),
    ]);
    legacyTaskId = legacyTask.id;
    genuineTaskId = genuineTask.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: [legacyTaskId, genuineTaskId] } } }).catch(() => undefined);
  });

  it("shifts legacy Tehran markers to canonical UTC day markers", async () => {
    await runMigration();

    const task = await prisma.task.findUnique({ where: { id: legacyTaskId } });
    expect(task).not.toBeNull();
    // start 20:30:00.000Z +03:30 -> 00:00:00.000Z next UTC day (same Tehran day)
    expect(task!.startDate!.toISOString()).toBe("2026-08-27T00:00:00.000Z");
    // end 20:30:00.000Z +03:30 -> 00:00:00.000Z next UTC day
    expect(task!.endDate!.toISOString()).toBe("2026-08-29T00:00:00.000Z");
    // due 20:29:59.999Z +03:30 -> 23:59:59.999Z same UTC day
    expect(task!.dueDate!.toISOString()).toBe("2026-08-28T23:59:59.999Z");
  });

  it("leaves genuine instants untouched", async () => {
    const task = await prisma.task.findUnique({ where: { id: genuineTaskId } });
    expect(task).not.toBeNull();
    expect(task!.dueDate!.toISOString()).toBe(genuineDue.toISOString());
  });

  it("is idempotent on already-canonical values", async () => {
    await runMigration();
    const task = await prisma.task.findUnique({ where: { id: legacyTaskId } });
    expect(task!.startDate!.toISOString()).toBe("2026-08-27T00:00:00.000Z");
    expect(task!.dueDate!.toISOString()).toBe("2026-08-28T23:59:59.999Z");
  });
});
