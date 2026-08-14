import { test, expect } from "@playwright/test";

type GanttTestTask = {
  id: string;
  isSummary: boolean;
  startDate: string | null;
  dueDate: string | null;
  summaryStart: string | null;
  summaryEnd: string | null;
};

type GanttTestResponse = {
  data: Record<string, { tasks: GanttTestTask[]; criticalChain?: string[] }>;
};

test.describe("Gantt timeline", () => {
  test("keeps task names visible while the timeline scrolls horizontally", async ({ page }) => {
    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();

    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    const label = chart.getByTestId("gantt-task-label").first();
    await expect(label).toBeVisible();

    const before = await label.boundingBox();
    const scrollInfo = await chart.evaluate((element) => {
      const container = element as HTMLElement;
      const amount = Math.min(300, container.scrollWidth - container.clientWidth);
      container.scrollLeft = amount;
      return {
        amount,
        scrollLeft: container.scrollLeft,
      };
    });

    expect(scrollInfo.amount).toBeGreaterThan(0);
    expect(scrollInfo.scrollLeft).toBe(scrollInfo.amount);
    await expect.poll(() => label.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");

    const after = await label.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(2);
  });

  test("renders the Critical path legend item only once", async ({ page }) => {
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      for (const report of Object.values(payload.data)) {
        const task = report.tasks.find((candidate) => !candidate.isSummary) ?? report.tasks[0];
        if (task) report.criticalChain = [task.id];
      }
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const charts = page.getByTestId("gantt-scroll-container");
    await expect(charts.first()).toBeVisible();
    const chartCount = await charts.count();
    let chartsWithLegend = 0;
    for (let index = 0; index < chartCount; index += 1) {
      const criticalPathCount = await charts.nth(index).locator("..").getByText("Critical path", { exact: true }).count();
      expect(criticalPathCount).toBeLessThanOrEqual(1);
      if (criticalPathCount === 1) chartsWithLegend += 1;
    }
    expect(chartsWithLegend).toBeGreaterThan(0);
  });

  test("keeps Persian timeline dates chronological from right to left", async ({ page }) => {
    await page.goto("/fa-IR");
    await page.getByRole("button", { name: "گانت", exact: true }).click();

    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    const days = chart.getByTestId("gantt-timeline-day");
    await expect(days.first()).toBeVisible();

    const positions = await days.evaluateAll((elements) => elements.map((element) => ({
      offset: Number(element.getAttribute("data-day-offset")),
      x: element.getBoundingClientRect().x,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    })));
    const earliest = positions.find((day) => day.offset === 0);
    const latest = positions.reduce((current, day) => (day.offset > current.offset ? day : current));

    expect(earliest).toBeDefined();
    expect(latest).toBeDefined();
    expect(earliest?.x).toBeGreaterThan(latest.x);
    expect(earliest?.fontSize).toBeGreaterThanOrEqual(14);

    const month = chart.getByTestId("gantt-timeline-month").first();
    await expect(month).toBeVisible();
    const monthFontSize = await month.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(monthFontSize).toBeGreaterThanOrEqual(14);

    const monthLabels = await chart.getByTestId("gantt-timeline-month").allTextContents();
    expect(monthLabels.every((label) => !/[,٬]/.test(label))).toBe(true);

    const taskDate = chart.getByTestId("gantt-task-date").first();
    await expect(taskDate).toBeVisible();
    const taskDateText = await taskDate.textContent();
    expect(taskDateText).toMatch(/(?:\d{4}|[۰-۹]{4})/);

    const dateLayout = await taskDate.evaluate((element) => ({
      dateOverflow: getComputedStyle(element).overflow,
      cellOverflow: getComputedStyle(element.parentElement as HTMLElement).overflow,
      zIndex: getComputedStyle(element).zIndex,
    }));
    expect(dateLayout.dateOverflow).toBe("visible");
    expect(dateLayout.cellOverflow).toBe("visible");
    expect(Number(dateLayout.zIndex)).toBeGreaterThan(0);

    const dateAlignment = await taskDate.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = element.getBoundingClientRect();
      const textRects = Array.from(range.getClientRects());
      return {
        textAlign: getComputedStyle(element).textAlign,
        rightGap: rect.right - Math.max(...textRects.map((textRect) => textRect.right)),
      };
    });
    expect(dateAlignment.textAlign).toBe("start");
    expect(dateAlignment.rightGap).toBeLessThan(2);
  });

  test("renders a multi-day task bar through the end of its due date", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the multi-day regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-21T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const bar = chart.locator(`[data-testid="gantt-task-bar"][data-task-id="${injectedTaskId}"]`);
    await expect(bar).toBeVisible();
    await expect.poll(() => bar.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width))).toBe(156);
  });

  test("keeps a same-day task inside exactly one calendar day", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the one-day regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T08:00:00.000Z";
      task.dueDate = "2026-08-19T16:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const bar = chart.locator(`[data-testid="gantt-task-bar"][data-task-id="${injectedTaskId}"]`);
    await expect(bar).toBeVisible();
    await expect.poll(() => bar.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width))).toBe(52);
    for (const testId of ["gantt-task-resize-start", "gantt-task-resize-due"]) {
      const handle = bar.getByTestId(testId);
      await expect(handle).toBeVisible();
      await expect.poll(() => handle.evaluate((element) => {
        const styles = getComputedStyle(element);
        return { cursor: styles.cursor, opacity: Number.parseFloat(styles.opacity) };
      })).toEqual({ cursor: "col-resize", opacity: 0.4 });
    }
  });

  test("resizes a one-day task earlier from its start edge", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the one-day start-edge regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-19T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const handle = chart.locator(`[data-testid="gantt-task-resize-start"][data-task-id="${injectedTaskId}"]`);
    await expect(handle).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("One-day start resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 52, centerY, { steps: 2 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload).toEqual({ startDate: "2026-08-18T00:00:00.000Z" });
  });

  test("resizes a one-day task later from its due edge", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the one-day due-edge regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-19T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const handle = chart.locator(`[data-testid="gantt-task-resize-due"][data-task-id="${injectedTaskId}"]`);
    await expect(handle).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("One-day due resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 52, centerY, { steps: 2 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload).toEqual({ dueDate: "2026-08-20T23:59:59.999Z" });
  });

  test("repaints both edges immediately after resizing a one-day task", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the one-day repaint regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-19T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const bar = chart.locator(`[data-testid="gantt-task-bar"][data-task-id="${injectedTaskId}"]`);
    const handle = bar.getByTestId("gantt-task-resize-due");
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("One-day due resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 52, centerY, { steps: 2 });
    await expect.poll(() => bar.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width))).toBe(104);
    const draggingStartBox = await bar.getByTestId("gantt-task-resize-start").boundingBox();
    const draggingDueBox = await bar.getByTestId("gantt-task-resize-due").boundingBox();
    expect(draggingStartBox).not.toBeNull();
    expect(draggingDueBox).not.toBeNull();
    expect((draggingDueBox?.x ?? 0) - (draggingStartBox?.x ?? 0)).toBeGreaterThan(52);
    await page.mouse.up();
    await patchRequest;

    await expect.poll(() => bar.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width))).toBe(104);
    const startBox = await bar.getByTestId("gantt-task-resize-start").boundingBox();
    const dueBox = await bar.getByTestId("gantt-task-resize-due").boundingBox();
    expect(startBox).not.toBeNull();
    expect(dueBox).not.toBeNull();
    expect((dueBox?.x ?? 0) - (startBox?.x ?? 0)).toBeGreaterThan(52);
  });

  test("moves both edges when a one-day start edge is dragged later", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the one-day start-shift regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-19T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const handle = chart.locator(`[data-testid="gantt-task-resize-start"][data-task-id="${injectedTaskId}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("One-day start resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 52, centerY, { steps: 2 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload).toEqual({
      startDate: "2026-08-20T00:00:00.000Z",
      dueDate: "2026-08-20T23:59:59.999Z",
    });
  });

  test("moves both edges when a one-day due edge is dragged earlier", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the one-day due-shift regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-19T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const handle = chart.locator(`[data-testid="gantt-task-resize-due"][data-task-id="${injectedTaskId}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("One-day due resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 52, centerY, { steps: 2 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload).toEqual({
      startDate: "2026-08-18T00:00:00.000Z",
      dueDate: "2026-08-18T23:59:59.999Z",
    });
  });

  test("resizes the start edge to the beginning of a calendar day", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the start-edge regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-21T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/en-US");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const bar = chart.locator(`[data-testid="gantt-task-bar"][data-task-id="${injectedTaskId}"]`);
    const handle = bar.getByTestId("gantt-task-resize-start");
    await expect(handle).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("Start resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 52, centerY, { steps: 2 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload).toEqual({ startDate: "2026-08-20T00:00:00.000Z" });
  });

  test("resizes the due edge to the end of a calendar day in RTL", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the due-edge regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-21T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/fa-IR");
    await page.getByRole("button", { name: "گانت", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const bar = chart.locator(`[data-testid="gantt-task-bar"][data-task-id="${injectedTaskId}"]`);
    const handle = bar.getByTestId("gantt-task-resize-due");
    await expect(handle).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("Due resize handle has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 52, centerY, { steps: 2 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload).toEqual({ dueDate: "2026-08-22T23:59:59.999Z" });
  });

  test("moves task dates in the pointer direction on the RTL timeline", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the RTL drag regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T00:00:00.000Z";
      task.dueDate = "2026-08-21T00:00:00.000Z";
      task.summaryStart = null;
      task.summaryEnd = null;
      await route.fulfill({ response, body: JSON.stringify(payload) });
    });

    await page.goto("/fa-IR");
    await page.getByRole("button", { name: "گانت", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible();
    await expect.poll(() => injectedTaskId).not.toBeNull();

    const bar = chart.locator(`[data-testid="gantt-task-bar"][data-task-id="${injectedTaskId}"]`);
    await expect(bar).toBeVisible();
    await bar.scrollIntoViewIfNeeded();
    const box = await bar.boundingBox();
    if (!box) throw new Error("RTL Gantt task bar has no browser geometry");
    const patchRequest = page.waitForRequest((request) => (
      request.method() === "PATCH" && request.url().includes(`/api/v1/tasks/${injectedTaskId}`)
    ));
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 104, centerY, { steps: 4 });
    await page.mouse.up();

    const payload = JSON.parse((await patchRequest).postData() ?? "{}");
    expect(payload.startDate).toBe("2026-08-21T00:00:00.000Z");
    expect(payload.dueDate).toBe("2026-08-23T23:59:59.999Z");
  });
});
