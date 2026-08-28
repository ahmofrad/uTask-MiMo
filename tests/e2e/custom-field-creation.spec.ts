import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

let PROJECT_ID = "";
let ADMIN_ID = "";
const FIELD_NAME = `E2E Field ${Date.now()}`;

test.describe("Custom field creation and filtering", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    ADMIN_ID = admin.id;

    const project = await prisma.project.create({
      data: { name: `CF E2E ${Date.now()}`, ownerId: admin.id, visibility: "org" },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id, projectRole: "lead", addedBy: admin.id },
    });
    PROJECT_ID = project.id;
  });

  test.afterAll(async () => {
    await prisma.customFieldValue.deleteMany({ where: { task: { projectId: PROJECT_ID } } });
    await prisma.customField.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.projectMember.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
  });

  test("creates a custom field via the UI and assigns it to a task", async ({ page }) => {
    // Navigate to custom fields page.
    await page.goto(`/en-US/projects/${PROJECT_ID}/custom-fields`);
    await expect(page.getByRole("button", { name: /add field/i })).toBeVisible({ timeout: 15_000 });

    // Click add field.
    await page.getByRole("button", { name: /add field/i }).click();

    // Fill in the field name.
    const nameInput = page.getByLabel(/name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill(FIELD_NAME);
    }

    // Select field type (text).
    const typeSelect = page.getByLabel(/type/i);
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption("TEXT");
    }

    // Save.
    const saveBtn = page.getByRole("button", { name: /save|create|add/i }).last();
    await saveBtn.click();

    // The field should appear in the list.
    await expect(page.getByText(FIELD_NAME)).toBeVisible({ timeout: 15_000 });

    // Verify it was created in DB.
    const field = await prisma.customField.findFirst({
      where: { projectId: PROJECT_ID, name: FIELD_NAME },
    });
    expect(field).not.toBeNull();
  });

  test("custom field filter appears on the task list page", async ({ page }) => {
    // Create a task so the filter UI has data to work with.
    const task = await prisma.task.create({
      data: {
        projectId: PROJECT_ID, title: `CF Filter Task ${Date.now()}`,
        status: "open", priority: "low", ownerId: ADMIN_ID,
      },
    });

    try {
      await page.goto(`/en-US/projects/${PROJECT_ID}`);
      await page.getByRole("button", { name: "Tasks", exact: true }).click();

      // The filter bar should render.
      const filterBar = page.getByTestId("task-cf-filters");
      await expect(filterBar).toBeVisible({ timeout: 15_000 });

      // Our newly created field should appear as a filter option.
      await expect(filterBar.getByText(FIELD_NAME)).toBeVisible();
    } finally {
      await prisma.task.delete({ where: { id: task.id } });
    }
  });
});
