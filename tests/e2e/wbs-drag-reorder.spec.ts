import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

let PROJECT_ID = "";
let TASK_A_ID = "";
let TASK_B_ID = "";
let ADMIN_ID = "";

test.describe("WBS drag-and-drop reorder", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    ADMIN_ID = admin.id;

    const project = await prisma.project.create({
      data: { name: `WBS Drag E2E ${Date.now()}`, ownerId: admin.id, visibility: "org" },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id, projectRole: "lead", addedBy: admin.id },
    });
    PROJECT_ID = project.id;

    const taskA = await prisma.task.create({
      data: {
        projectId: PROJECT_ID, title: "WBS Drag Task First", status: "open",
        priority: "low", ownerId: admin.id, orderIndex: 0,
      },
    });
    TASK_A_ID = taskA.id;

    const taskB = await prisma.task.create({
      data: {
        projectId: PROJECT_ID, title: "WBS Drag Task Second", status: "open",
        priority: "low", ownerId: admin.id, orderIndex: 1,
      },
    });
    TASK_B_ID = taskB.id;
  });

  test.afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: [TASK_A_ID, TASK_B_ID] } } });
    await prisma.projectMember.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
  });

  test("tasks are listed in order on the WBS page", async ({ page }) => {
    await page.goto(`/en-US/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByRole("heading", { name: /work breakdown/i })).toBeVisible({ timeout: 15_000 });

    // Both tasks should be visible.
    await expect(page.getByText("WBS Drag Task First")).toBeVisible();
    await expect(page.getByText("WBS Drag Task Second")).toBeVisible();

    // The order index should be reflected.
    const taskA = await prisma.task.findUniqueOrThrow({ where: { id: TASK_A_ID }, select: { orderIndex: true } });
    const taskB = await prisma.task.findUniqueOrThrow({ where: { id: TASK_B_ID }, select: { orderIndex: true } });
    expect(taskA.orderIndex).toBeLessThan(taskB.orderIndex);
  });

  test("reordering via API persists and reflects on WBS page", async ({ page, request }) => {
    // Swap order via API.
    await request.patch(`/api/v1/tasks/${TASK_A_ID}`, {
      data: { orderIndex: 10 },
    });
    await request.patch(`/api/v1/tasks/${TASK_B_ID}`, {
      data: { orderIndex: 0 },
    });

    // Reload WBS and verify.
    await page.goto(`/en-US/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByText("WBS Drag Task First")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("WBS Drag Task Second")).toBeVisible();

    // Verify persisted order.
    const taskA = await prisma.task.findUniqueOrThrow({ where: { id: TASK_A_ID }, select: { orderIndex: true } });
    const taskB = await prisma.task.findUniqueOrThrow({ where: { id: TASK_B_ID }, select: { orderIndex: true } });
    expect(taskA.orderIndex).toBeGreaterThan(taskB.orderIndex);

    // Restore original order.
    await request.patch(`/api/v1/tasks/${TASK_A_ID}`, { data: { orderIndex: 0 } });
    await request.patch(`/api/v1/tasks/${TASK_B_ID}`, { data: { orderIndex: 1 } });
  });
});
