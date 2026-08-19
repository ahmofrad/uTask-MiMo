import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// Calendar drags use HTML5 drag-and-drop; Playwright's dragAndDrop drives real
// drag events (raw mouse events do not synthesize dragstart/drop).
test.describe("calendar drag-to-reschedule", () => {
  let taskId: string;
  let originalDue: string;
  let originalStart: string | null;

  test.beforeAll(async () => {
    const project = await prisma.project.findFirstOrThrow({
      where: { name: "Product Launch" },
      select: { id: true },
    });
    const task = await prisma.task.findFirstOrThrow({
      where: { projectId: project.id, dueDate: { not: null }, deletedAt: null },
      orderBy: { dueDate: "asc" },
      select: { id: true, dueDate: true, startDate: true },
    });
    taskId = task.id;
    originalDue = task.dueDate!.toISOString();
    originalStart = task.startDate ? task.startDate.toISOString() : null;
  });

  test.afterAll(async () => {
    // Restore the exact dates so the suite never mutates seed data.
    await prisma.task.update({
      where: { id: taskId },
      data: { dueDate: new Date(originalDue), startDate: originalStart ? new Date(originalStart) : null },
    });
  });

  test("drag a task to another day on the project calendar", async ({ page }) => {
    const project = await prisma.project.findFirstOrThrow({
      where: { name: "Product Launch" },
      select: { id: true },
    });

    await page.goto(`/en-US/projects/${project.id}`);
    await page.getByRole("button", { name: /calendar/i }).first().click();
    const bar = page.locator(`a[href="/tasks/${taskId}"]`);
    await expect(bar).toBeVisible();

    // Compute the day-cell index from the same geometry the calendar uses:
    // 7 weekday headers + startOffset empty cells + the target day.
    const targetCell = await page.evaluate(() => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOffset = (firstDay.getDay() + 1) % 7;
      // A day a few cells into the month, far from the task's own due day.
      const targetDay = Math.max(5, Math.min(now.getDate() + 4, 28));
      return 7 + startOffset + targetDay;
    });

    const barBox = await bar.boundingBox();
    expect(barBox).not.toBeNull();

    // Track the PATCH so we know the drag actually rescheduled.
    const patchBody = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/tasks/${taskId}`) && res.request().method() === "PATCH",
    );

    await page.dragAndDrop(`a[href="/tasks/${taskId}"]`, `.grid.grid-cols-7 > div:nth-child(${targetCell})`, {
      sourcePosition: { x: (barBox as { width: number }).width / 2, y: (barBox as { width: number }).height / 2 },
    });

    const response = await patchBody;
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data?: { dueDate: string | null } };
    expect(body.data?.dueDate).not.toBe(originalDue);
  });
});

test("dashboard calendar tasks are draggable", async ({ page }) => {
  await page.goto("/en-US");
  await page.getByRole("button", { name: /calendar/i }).first().click();

  // Tasks render on the dashboard calendar with drag enabled (onMove wired).
  await expect(page.locator('a[draggable="true"]').first()).toBeVisible();
  const draggable = await page.locator('a[draggable="true"]').count();
  const total = await page.locator('.grid.grid-cols-7 a[href^="/tasks/"]').count();
  expect(total).toBeGreaterThan(0);
  expect(draggable).toBe(total);
});
