import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TestMetric" (
      id SERIAL PRIMARY KEY,
      value INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `);
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "TestMetric"`);
  await prisma.$disconnect();
});

describe("Materialized view refresh", () => {
  it("creates and refreshes a materialized view", async () => {
    // Create a materialized view
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "MvTestMetric" AS
      SELECT id, value FROM "TestMetric"
    `);

    // Insert data
    await prisma.$executeRawUnsafe(`INSERT INTO "TestMetric" (value) VALUES (1), (2), (3)`);

    // Refresh the view
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW "MvTestMetric"`);

    // Verify data is visible
    const rows = await prisma.$queryRawUnsafe<{ id: number; value: number }[]>(
      `SELECT id, value FROM "MvTestMetric" ORDER BY id`,
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.value)).toEqual([1, 2, 3]);

    // Cleanup
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW "MvTestMetric"`);
  });

  it("concurrent refresh requires unique index", async () => {
    // Create materialized view with unique index for CONCURRENTLY refresh
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "MvConcurrentTest" AS
      SELECT id, value FROM "TestMetric"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_mv_concurrent_test_id" ON "MvConcurrentTest" (id)
    `);

    // Insert more data
    await prisma.$executeRawUnsafe(`INSERT INTO "TestMetric" (value) VALUES (4), (5)`);

    // Concurrent refresh should work
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY "MvConcurrentTest"`);

    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "MvConcurrentTest"`,
    );

    expect(Number(rows[0]!.count)).toBe(5);

    // Cleanup
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW "MvConcurrentTest"`);
  });
});
