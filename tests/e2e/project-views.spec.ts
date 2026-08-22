import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

test.describe("Project views", () => {
  test("board, dashboard, members, tags, wbs and custom-fields pages render", async ({ page }) => {
    // Create our own project so the target is deterministic (the project list
    // is ordered by createdAt desc and parallel specs create/delete throwaway
    // projects mid-run).
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true, displayName: true },
    });
    const project = await prisma.project.create({
      data: { name: `Project Views E2E ${Date.now()}`, ownerId: admin.id, visibility: "org" },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id, projectRole: "owner", addedBy: admin.id },
    });

    try {
      // Board: project name as the h1.
      await page.goto(`/en-US/projects/${project.id}/board`);
      await expect(page.getByRole("heading", { name: project.name, level: 1 })).toBeVisible();

      // Dashboard.
      await page.goto(`/en-US/projects/${project.id}/dashboard`);
      await expect(page.getByRole("heading", { name: "Project Dashboard", level: 1 })).toBeVisible();

      // Members: the owner row is listed.
      await page.goto(`/en-US/projects/${project.id}/members`);
      await expect(page.getByText(admin.displayName).first()).toBeVisible();

      // Tags: heading carries the project name.
      await page.goto(`/en-US/projects/${project.id}/tags`);
      await expect(page.getByRole("heading", { name: new RegExp(project.name), level: 1 })).toBeVisible();

      // WBS: the editor title renders.
      await page.goto(`/en-US/projects/${project.id}/wbs`);
      await expect(page.getByRole("heading", { name: /work breakdown/i, level: 1 })).toBeVisible();

      // Custom fields: the add-field action is present.
      await page.goto(`/en-US/projects/${project.id}/custom-fields`);
      await expect(page.getByRole("button", { name: /add field/i })).toBeVisible();
    } finally {
      await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
      await prisma.task.deleteMany({ where: { projectId: project.id } });
      await prisma.project.deleteMany({ where: { id: project.id } });
    }
  });
});
