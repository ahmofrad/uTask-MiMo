import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

let PROJECT_ID = "";
let ADMIN_ID = "";
const PROJECT_NAME = `Archive E2E ${Date.now()}`;

test.describe("Project archive / unarchive", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    ADMIN_ID = admin.id;

    const project = await prisma.project.create({
      data: { name: PROJECT_NAME, ownerId: admin.id, visibility: "org" },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id, projectRole: "lead", addedBy: admin.id },
    });
    PROJECT_ID = project.id;
  });

  test.afterAll(async () => {
    // Restore to active state if archived.
    await prisma.project.updateMany({ where: { id: PROJECT_ID }, data: { status: "active" } });
    await prisma.projectMember.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
  });

  test("archived project is hidden from the project list", async ({ page }) => {
    // Navigate to the projects list.
    await page.goto("/en-US/projects");
    await expect(page.getByText(PROJECT_NAME)).toBeVisible({ timeout: 15_000 });

    // Archive the project via the settings.
    await page.goto(`/en-US/projects/${PROJECT_ID}`);
    const settingsBtn = page.getByRole("button", { name: /settings|edit/i });
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
    }

    const archiveBtn = page.getByRole("button", { name: /archive/i });
    if (await archiveBtn.isVisible()) {
      await archiveBtn.click();
      // Confirm if there's a confirmation dialog.
      const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
    }

    // Verify the project is now archived.
    const proj = await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID }, select: { status: true } });
    expect(proj.status).toBe("archived");

    // The project list should not show it.
    await page.goto("/en-US/projects");
    await expect(page.getByText(PROJECT_NAME)).toHaveCount(0);
  });

  test("unarchived project reappears in the project list", async ({ page }) => {
    // Restore via API/DB.
    await prisma.project.update({ where: { id: PROJECT_ID }, data: { status: "active" } });

    await page.goto("/en-US/projects");
    await expect(page.getByText(PROJECT_NAME)).toBeVisible({ timeout: 15_000 });
  });
});
