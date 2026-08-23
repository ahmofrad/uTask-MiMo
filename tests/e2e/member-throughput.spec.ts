import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

const EMAIL = `mt-e2e-${Date.now()}@utask.local`;
const DISPLAY_NAME = `MT E2E ${Date.now()}`;

const THROUGHPUT_KEY = `report:member-throughput:v1:${DEFAULT_ORGANIZATION_ID}`;

/**
 * Member monitoring (M6): the /admin/insights page renders a per-member
 * throughput table derived from the org-wide taskAssignee rows. The report is
 * cached in Redis for 60 s, so this spec busts the cache before asserting and
 * creates a dedicated done+assigned task to make the row deterministic.
 */
test.describe("Member throughput report", () => {
  test("task completion shows up in the member table", async ({ page, request }) => {
    // 1. Fresh user + a task completed just now by them.
    const [admin, project] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { email: "admin@utask.local" }, select: { id: true } }),
      prisma.project.findFirstOrThrow({ where: { archivedAt: null } }),
    ]);
    const user = await prisma.user.create({
      data: { email: EMAIL, displayName: DISPLAY_NAME, locale: "en_US", status: "active" },
    });
    const task = await prisma.task.create({
      data: {
        title: `Member throughput ${Date.now()}`,
        status: "done",
        completedAt: new Date(),
        projectId: project.id,
        createdById: admin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.taskAssignee.create({
      data: { taskId: task.id, userId: user.id },
    });

    const redis = await getRedis();
    await redis.del(THROUGHPUT_KEY);

    try {
      // 2. The report API returns the row.
      const res = await request.get("/api/v1/reports/org");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        data: { memberThroughput: { userId: string; completed30: number }[] };
      };
      const row = body.data.memberThroughput.find((m) => m.userId === user.id);
      expect(row, "fresh member row should appear in the API report").toBeTruthy();
      expect(row!.completed30).toBeGreaterThanOrEqual(1);

      // 3. The insights page renders the table with the member's row.
      // The display name is unique per run, so the row is unambiguous even
      // though the seeded sample data also populates the table.
      await page.goto("/en-US/admin/insights");
      await expect(
        page.getByRole("heading", { name: "Member output (last 30 days)" }),
      ).toBeVisible();
      const tableRow = page.locator("tbody tr").filter({ hasText: DISPLAY_NAME });
      await expect(tableRow).toHaveCount(1);
      // No due date → the completion counts as on time (100%).
      await expect(tableRow).toContainText("100%");
    } finally {
      await prisma.taskAssignee.deleteMany({ where: { taskId: task.id } });
      await prisma.task.delete({ where: { id: task.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await redis.del(THROUGHPUT_KEY);
    }
  });
});