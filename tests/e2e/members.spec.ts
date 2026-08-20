import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

test.describe("Project members", () => {
  test("can navigate to project and see members", async ({ page }) => {
    // Regression: this test used to click the first project link on /projects.
    // The list is ordered by createdAt desc, and parallel specs create/delete
    // throwaway projects mid-run — the "first" link could point at a transient
    // fixture and 404. Create our own project so the target is deterministic.
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    const member = await prisma.user.findUniqueOrThrow({
      where: { email: "member@utask.local" },
      select: { id: true },
    });
    const project = await prisma.project.create({
      data: { name: `Members E2E ${Date.now()}`, ownerId: admin.id, visibility: "org" },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: member.id, projectRole: "contributor", addedBy: admin.id },
    });

    try {
      await page.goto("/projects");
      const link = page.locator(`a[href^='/projects/${project.id}']`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}`));
      // The header shows the member-count button for the single member.
      await expect(page.getByRole("button", { name: /member/i })).toBeVisible();
    } finally {
      await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
      await prisma.project.deleteMany({ where: { id: project.id } });
    }
  });
});
