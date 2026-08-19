import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// Covers the task activity timeline happy path: audit events (task created /
// updated) and comments render on the task detail page, and the diff
// expander reveals the before/after values.

test("task detail shows audit events and comments in the activity timeline", async ({ page }) => {
  const project = await prisma.project.findFirstOrThrow({ where: { name: "Product Launch" }, select: { id: true } });

  // Build a scratch task with real activity through the API (admin session),
  // then clean it up afterwards. page.request carries the browser session
  // cookies (the bare `request` fixture has none, so API calls would 401);
  // mutations also need the CSRF token cookie and POSTs an Idempotency-Key.
  const csrf = (await page.context().cookies()).find((c) => c.name === "csrf_token")?.value ?? "";
  const csrfHeaders: Record<string, string> = csrf ? { "x-csrf-token": csrf } : {};

  const createRes = await page.request.post("/api/v1/tasks", {
    headers: { "Idempotency-Key": `activity-e2e-create-${Date.now()}`, ...csrfHeaders },
    data: { title: "Activity timeline e2e task", projectId: project.id },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { data?: { id: string } };
  const taskId = created.data?.id;
  expect(taskId).toBeDefined();

  test.info().annotations.push({ type: "cleanup", description: taskId as string });

  const renameRes = await page.request.patch(`/api/v1/tasks/${taskId}`, {
    headers: csrfHeaders,
    data: { title: "Activity timeline e2e task (renamed)" },
  });
  expect(renameRes.ok()).toBeTruthy();

  const commentRes = await page.request.post(`/api/v1/tasks/${taskId}/comments`, {
    headers: { "Idempotency-Key": `activity-e2e-comment-${Date.now()}`, ...csrfHeaders },
    data: { bodyMarkdown: "Activity timeline e2e comment" },
  });
  expect(commentRes.ok()).toBeTruthy();

  await page.goto(`/en-US/tasks/${taskId}`);
  // The page renders the timeline in two layouts (desktop/mobile variants).
  const timeline = page.getByTestId("activity-timeline").first();
  await expect(timeline).toBeVisible({ timeout: 15000 });

  // Audit entries: creation and the rename.
  await expect(timeline.getByText("created task", { exact: true })).toBeVisible();
  await expect(timeline.getByText("updated task", { exact: true })).toBeVisible();

  // Comment entry with its body.
  await expect(timeline.getByText("commented", { exact: true })).toBeVisible();
  await expect(timeline.getByText("Activity timeline e2e comment")).toBeVisible();

  // Diff expander on the update event shows the title before/after.
  await timeline.getByText("Show details", { exact: true }).first().click();
  await expect(timeline.getByText("Activity timeline e2e task", { exact: true })).toBeVisible();

  // Soft-delete the scratch task so it never shows up in product views.
  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
});
