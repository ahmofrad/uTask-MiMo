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
  data: Record<string, { tasks: GanttTestTask[] }>;
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

  test("renders a multi-day task bar across its inclusive date span", async ({ page }) => {
    let injectedTaskId: string | null = null;
    await page.route("**/api/v1/reports/gantt**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json() as GanttTestResponse;
      const report = Object.values(payload.data)[0];
      const task = report?.tasks.find((candidate) => !candidate.isSummary) ?? report?.tasks[0];
      if (!task) throw new Error("No Gantt task available for the multi-day regression");

      injectedTaskId = task.id;
      task.startDate = "2026-08-19T12:00:00.000Z";
      task.dueDate = "2026-08-21T12:00:00.000Z";
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
});
