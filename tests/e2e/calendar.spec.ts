import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// Calendar drags use HTML5 drag-and-drop; Playwright's dragAndDrop drives real
// drag events (raw mouse events do not synthesize dragstart/drop).
test.describe("calendar drag-to-reschedule", () => {
  let projectId: string;
  let taskId: string;
  let originalDue: string;

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    const project = await prisma.project.create({
      data: { name: `Calendar drag E2E ${Date.now()}`, ownerId: admin.id, visibility: "org" },
    });
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Calendar drag e2e task",
        status: "open",
        priority: "med",
        createdById: admin.id,
        reporterId: admin.id,
        startDate: new Date("2026-08-10T00:00:00.000Z"),
        dueDate: new Date("2026-08-12T23:59:59.999Z"),
      },
    });
    projectId = project.id;
    taskId = task.id;
    originalDue = task.dueDate!.toISOString();
  });

  test.afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  test("drag a task to another day on the project calendar", async ({ page }) => {
    await page.goto(`/en-US/projects/${projectId}`);
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

    // Track the PATCH so we know the drag actually rescheduled. The calendar
    // repaints on realtime task events, so retry until a PATCH actually lands.
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3 && !response; attempt++) {
      const barBox = await bar.boundingBox();
      if (!barBox) break;
      const pending = page.waitForResponse(
        (res) => res.url().includes(`/api/v1/tasks/${taskId}`) && res.request().method() === "PATCH",
        { timeout: 10_000 },
      );
      await page.dragAndDrop(`a[href="/tasks/${taskId}"]`, `.grid.grid-cols-7 > div:nth-child(${targetCell})`, {
        sourcePosition: { x: barBox.width / 2, y: barBox.height / 2 },
      });
      try {
        response = await pending;
      } catch {
        // The drag was interrupted; retry.
      }
    }
    expect(response).not.toBeNull();
    expect((response as Response).status()).toBe(200);
    const body = (await (response as Response).json()) as { data?: { dueDate: string | null } };
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
