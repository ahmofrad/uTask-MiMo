import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

describe("Database schema", () => {
  it("prisma generate succeeds", () => {
    expect(() => execSync("npx prisma generate", { cwd: process.cwd() })).not.toThrow();
  });

  it("keeps the search and retention migration additive", () => {
    const sql = readFileSync(
      "prisma/migrations/20260823140000_search_and_retention_indexes/migration.sql",
      "utf8",
    );
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS \"Task_title_trgm_idx\"");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS \"WebhookDelivery_retention_idx\"");
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/i);
  });
});

maybe("PostgreSQL schema metadata", () => {
  it("exposes the composite indexes used by cursor-ordered lists", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'Project_createdAt_id_idx',
          'Task_createdAt_id_idx',
          'Webhook_createdAt_id_idx',
          'Comment_taskId_createdAt_id_idx',
          'User_displayName_id_idx',
          'CustomField_projectId_orderIndex_id_idx'
        )
    `;
    expect(new Set(rows.map((row) => row.indexname)).size).toBe(6);
  });
});
