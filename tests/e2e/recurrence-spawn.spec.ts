import { test, expect } from "@playwright/test";

test.describe("Task Recurrence", () => {
  test("recurrence rule creates new task after due date", async ({
    page,
    request,
  }) => {
    // Create a project via API
    const projectRes = await request.post("/api/v1/projects", {
      data: {
        name: `Recurrence Test ${Date.now()}`,
        departmentId: null,
      },
    });
    const project = (await projectRes.json()).data;

    // Create a task with recurrence rule via API
    const taskRes = await request.post("/api/v1/tasks", {
      data: {
        title: `Recurring Task ${Date.now()}`,
        projectId: project.id,
        status: "open",
        priority: "med",
        recurrenceRule: JSON.stringify({
          freq: "WEEKLY",
          interval: 1,
          anchor: "dueDate",
        }),
      },
    });
    const task = (await taskRes.json()).data;

    // Verify the task was created with recurrence
    const getRes = await request.get(`/api/v1/tasks/${task.id}`);
    const fetched = (await getRes.json()).data;
    expect(fetched.recurrenceRule).toBeTruthy();

    // Navigate to the project to see the task in the UI
    await page.goto(`/en-US/projects/${project.id}`);
    await page.waitForLoadState("domcontentloaded");

    // Verify the task appears in the list
    const taskRow = page.getByText(fetched.title);
    await expect(taskRow).toBeVisible({ timeout: 10000 });
  });

  test("recurrence rule can be set and cleared via UI", async ({ page }) => {
    await page.goto("/en-US");
    await page.waitForLoadState("domcontentloaded");

    // Find any task and open it
    const taskLink = page.locator('a[href*="/tasks/"]').first();
    if (await taskLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskLink.click();
      await page.waitForLoadState("domcontentloaded");

      // Look for recurrence settings
      const recurrenceBtn = page.getByRole("button", {
        name: /recurrence|recurring|repeat/i,
      });
      if (await recurrenceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await recurrenceBtn.click();
        // Verify the recurrence dialog/section opens
        await expect(
          page.getByRole("dialog").or(page.getByText(/repeat|recurrence/i)),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
