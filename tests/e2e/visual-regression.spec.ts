import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import type { GanttReport } from "@/lib/gantt-types";
import type { WbsNode } from "@/lib/tasks/wbs";

test.describe("Unauthenticated visual regression @visual", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login-page.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("home page renders in dark mode", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark");
    });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login-page-dark.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("login page in RTL", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", "fa-IR");
    });
    await expect(page).toHaveScreenshot("login-page-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});

// The Gantt timeline is a function of both the report dates and the client
// clock (today marker, weekend tints, Jalali month labels), so every Gantt
// screenshot pins both: a frozen browser clock and a fixed report. This keeps
// the committed baselines stable no matter when the suite is run or what the
// seeded task dates are.
const GANTT_RTL_REPORT: GanttReport = {
  tasks: [
    {
      id: "rtl-visual-1",
      title: "Design new dashboard layout",
      wbsCode: "1.1",
      parentTaskId: null,
      depth: 0,
      isSummary: false,
      isMilestone: false,
      status: "open",
      progress: 0,
      startDate: "2026-08-17T00:00:00.000Z",
      dueDate: "2026-08-19T23:59:59.999Z",
      critical: true,
      floatDays: 0,
    },
    {
      id: "rtl-visual-2",
      title: "Implement login flow",
      wbsCode: "1.2",
      parentTaskId: null,
      depth: 0,
      isSummary: false,
      isMilestone: false,
      status: "in_progress",
      progress: 40,
      startDate: "2026-08-20T00:00:00.000Z",
      dueDate: "2026-08-22T23:59:59.999Z",
      critical: true,
      floatDays: 0,
    },
    {
      id: "rtl-visual-3",
      title: "Write release notes",
      wbsCode: "1.3",
      parentTaskId: null,
      depth: 0,
      isSummary: false,
      isMilestone: false,
      status: "done",
      progress: 100,
      startDate: "2026-08-23T00:00:00.000Z",
      dueDate: "2026-08-25T23:59:59.999Z",
    },
    {
      id: "rtl-visual-4",
      title: "QA & hardening",
      wbsCode: "2",
      parentTaskId: null,
      depth: 0,
      isSummary: true,
      isMilestone: false,
      status: "in_progress",
      progress: 0,
      startDate: null,
      dueDate: null,
      summaryStart: "2026-08-18T00:00:00.000Z",
      summaryEnd: "2026-08-25T23:59:59.999Z",
    },
    {
      id: "rtl-visual-5",
      title: "Launch milestone",
      wbsCode: "3",
      parentTaskId: null,
      depth: 0,
      isSummary: false,
      isMilestone: true,
      status: "open",
      progress: 0,
      startDate: "2026-08-26T00:00:00.000Z",
      dueDate: null,
    },
  ],
  links: [
    {
      id: "rtl-visual-link",
      source: "rtl-visual-1",
      target: "rtl-visual-2",
      type: "FINISH_TO_START",
      lag: 0,
      lagUnit: "DAY",
    },
  ],
  criticalChain: ["rtl-visual-1", "rtl-visual-2"],
  scheduleVersion: 1,
  project: { start: "2026-08-17T00:00:00.000Z", end: "2026-08-26T00:00:00.000Z" },
  canEdit: true,
};

// A small, fixed WBS tree (a summary group with children plus a leaf) so the
// RTL row layout, indent padding, and sticky title column stay deterministic.
const WBS_RTL_TREE: WbsNode[] = [
  {
    id: "wbs-visual-1",
    title: "Design new dashboard layout",
    status: "in_progress",
    priority: "high",
    parentTaskId: null,
    assigneeIds: ["u-1"],
    assigneeNames: ["Maryam"],
    progress: 40,
    estimatedHours: 8,
    depth: 0,
    wbsCode: "1",
    isSummary: true,
    childCount: 2,
    rollupPercent: 40,
    orderIndex: 1,
  },
  {
    id: "wbs-visual-1-1",
    title: "Create wireframes",
    status: "done",
    priority: "med",
    parentTaskId: "wbs-visual-1",
    assigneeIds: ["u-2"],
    assigneeNames: ["Ali"],
    progress: 100,
    estimatedHours: 3,
    depth: 1,
    wbsCode: "1.1",
    isSummary: false,
    childCount: 0,
    rollupPercent: 0,
    orderIndex: 1,
  },
  {
    id: "wbs-visual-1-2",
    title: "Review with stakeholders",
    status: "open",
    priority: "urgent",
    parentTaskId: "wbs-visual-1",
    assigneeIds: [],
    assigneeNames: [],
    progress: 0,
    estimatedHours: 2,
    depth: 1,
    wbsCode: "1.2",
    isSummary: false,
    childCount: 0,
    rollupPercent: 0,
    orderIndex: 2,
  },
  {
    id: "wbs-visual-2",
    title: "Write release notes",
    status: "open",
    priority: "low",
    parentTaskId: null,
    assigneeIds: ["u-3"],
    assigneeNames: ["Sara"],
    progress: 0,
    estimatedHours: 1,
    depth: 0,
    wbsCode: "2",
    isSummary: false,
    childCount: 0,
    rollupPercent: 0,
    orderIndex: 2,
  },
];

// Fixed tasks for the calendar view, anchored inside August 2026 so they land
// in the Mordad 1405 grid the frozen clock renders. Mixed statuses/priorities
// exercise the status chips, priority dots, and progress bars in RTL.
const CALENDAR_RTL_TASKS = [
  {
    id: "cal-visual-1",
    title: "Design new dashboard layout",
    status: "open",
    priority: "high",
    dueDate: "2026-08-17T23:59:59.999Z",
    startDate: "2026-08-17T00:00:00.000Z",
    progress: 0,
  },
  {
    id: "cal-visual-2",
    title: "Implement login flow",
    status: "in_progress",
    priority: "med",
    dueDate: "2026-08-19T23:59:59.999Z",
    startDate: "2026-08-19T00:00:00.000Z",
    progress: 40,
  },
  {
    id: "cal-visual-3",
    title: "Write release notes",
    status: "done",
    priority: "low",
    dueDate: "2026-08-23T23:59:59.999Z",
    startDate: "2026-08-23T00:00:00.000Z",
    progress: 100,
  },
  {
    id: "cal-visual-4",
    title: "Security audit sign-off",
    status: "open",
    priority: "urgent",
    dueDate: "2026-08-26T23:59:59.999Z",
    startDate: "2026-08-26T00:00:00.000Z",
    progress: 0,
  },
  {
    id: "cal-visual-5",
    title: "Coordinate with PR team",
    status: "in_progress",
    priority: "med",
    dueDate: "2026-08-29T23:59:59.999Z",
    startDate: "2026-08-29T00:00:00.000Z",
    progress: 20,
  },
];

// Serve the fixed Gantt report and an empty working-day config (the
// working-days suite temporarily writes holiday/weekend configs to the DB;
// serving the default keeps weekend tints and holiday markers identical on
// every run, regardless of what other specs left behind).
async function mockGanttReport(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-19T12:00:00Z"));
  await page.route("**/api/v1/projects/*/reports/gantt**", async (route) => {
    await route.fulfill({ json: { data: GANTT_RTL_REPORT } });
  });
  await page.route("**/api/v1/working-days**", async (route) => {
    await route.fulfill({ json: { data: { weekendDays: [], holidays: [] } } });
  });
}

async function seededProductLaunchId() {
  return (
    await prisma.project.findFirstOrThrow({
      where: { name: "Product Launch" },
      select: { id: true },
    })
  ).id;
}

// The approval banner only renders for tasks awaiting approval, so the visual
// check creates a throwaway project + task in that state (admin is both the
// project owner and the designated approver, so the Approve/Reject controls
// show for the logged-in admin) and screenshots the banner element itself.
// Cropping to the element keeps the baseline independent of the page's
// date-dependent activity timeline; fixed timestamps keep any relative labels
// stable regardless of when the suite runs.
async function createApprovalBannerFixture() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@utask.local" },
    select: { id: true },
  });
  const project = await prisma.project.create({
    data: {
      name: "Approval Banner Visual Fixture",
      ownerId: admin.id,
      visibility: "org",
    },
  });
  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Approval banner visual fixture task",
      description: "A task awaiting approval.",
      status: "pending_approval",
      requiresApproval: true,
      approverId: admin.id,
      createdById: admin.id,
      reporterId: admin.id,
      createdAt: new Date("2026-08-10T09:00:00.000Z"),
      updatedAt: new Date("2026-08-10T09:00:00.000Z"),
    },
  });
  return { projectId: project.id, taskId: task.id };
}

async function cleanupApprovalBannerFixture(projectId: string) {
  await prisma.task.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
}

test.describe("Authenticated visual regression @visual", () => {
  test("admin page renders correctly", async ({ page, context }) => {
    // Must be logged in as admin — stub session cookie
    await context.addCookies([
      { name: "next-auth.session-token", value: "mock-session", domain: "localhost", path: "/" },
    ]);
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("admin-users.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("tasks page rendered", async ({ page }) => {
    await page.goto("/my-tasks");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("tasks-list.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("gantt chart renders correctly in RTL", async ({ page }) => {
    await mockGanttReport(page);

    const projectId = await seededProductLaunchId();
    await page.goto(`/fa-IR/projects/${projectId}`);
    await page.getByRole("button", { name: "گانت", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible({ timeout: 15000 });
    await expect(chart.getByTestId("gantt-task-bar").first()).toBeVisible();
    await expect(page).toHaveScreenshot("gantt-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("gantt dependency panel renders correctly in RTL", async ({ page }) => {
    await mockGanttReport(page);

    const projectId = await seededProductLaunchId();
    await page.goto(`/fa-IR/projects/${projectId}`);
    await page.getByRole("button", { name: "گانت", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible({ timeout: 15000 });

    // Open the dependencies panel, which mirrors the link row (arrow
    // direction, type label, lag, edit controls) in RTL.
    await page.getByTestId("gantt-deps-toggle").click();
    const panel = page.getByTestId("gantt-deps-panel").first();
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("gantt-dep-row")).toHaveCount(1);
    await expect(page).toHaveScreenshot("gantt-deps-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("wbs tree renders correctly in RTL", async ({ page }) => {
    await page.route("**/api/v1/projects/*/wbs**", async (route) => {
      await route.fulfill({ json: { data: WBS_RTL_TREE } });
    });

    const projectId = await seededProductLaunchId();
    await page.goto(`/fa-IR/projects/${projectId}`);
    await page.getByRole("button", { name: "ساختار شکست کار", exact: true }).click();
    const editor = page.getByTestId("wbs-editor").first();
    await expect(editor).toBeVisible({ timeout: 15000 });
    await expect(editor.getByTestId("wbs-row")).toHaveCount(4);
    await expect(page).toHaveScreenshot("wbs-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("calendar view renders correctly in RTL", async ({ page }) => {
    // The calendar shows the month of the client clock and tints weekends/holidays
    // from the working-day config, and its tasks come from a client fetch — so
    // pin all three: frozen clock, fixed tasks, default calendar config.
    await page.clock.setFixedTime(new Date("2026-08-19T12:00:00Z"));
    await page.route("**/api/v1/tasks**", async (route) => {
      await route.fulfill({ json: { data: CALENDAR_RTL_TASKS } });
    });
    await page.route("**/api/v1/working-days**", async (route) => {
      await route.fulfill({ json: { data: { weekendDays: [], holidays: [] } } });
    });

    await page.goto("/fa-IR/calendar");
    const firstCell = page.getByTestId("calendar-day").first();
    await expect(firstCell).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Design new dashboard layout")).toBeVisible();
    await expect(page).toHaveScreenshot("calendar-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("board view renders correctly in RTL", async ({ page }) => {
    // The board is the project page's default tab and renders the seeded tasks
    // server-side; the frozen clock keeps the due-date chip tints (overdue/soon)
    // deterministic against the seeded dates. Mirrored layout check: the four
    // status columns should flow right-to-left.
    await page.clock.setFixedTime(new Date("2026-08-19T12:00:00Z"));

    const projectId = await seededProductLaunchId();
    await page.goto(`/fa-IR/projects/${projectId}`);
    // The board is server-rendered, so its text is in the DOM during hydration,
    // when React 19's streaming Suspense container (<div id="S:1">) can briefly
    // hold a hidden duplicate of the page tree. .first() targets the visible
    // main-content copy (which always precedes it in DOM order), same pattern
    // the other project-page tests use.
    await expect(page.getByText("Finalize launch checklist").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("board-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("task detail page renders correctly in RTL", async ({ page }) => {
    // The activity timeline renders relative timestamps from the client clock,
    // so pin it; the seeded task itself is stable.
    await page.clock.setFixedTime(new Date("2026-08-19T12:00:00Z"));

    const task = await prisma.task.findFirstOrThrow({
      where: { title: "Finalize launch checklist" },
      select: { id: true },
    });
    await page.goto(`/fa-IR/tasks/${task.id}`);
    await expect(page.getByRole("heading", { name: "Finalize launch checklist" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("task-detail-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  // The approval banner is a mirrored flex row (approver note on one side,
  // Approve/Reject controls on the other), so it gets both directions. The
  // reject-expanded state adds the mirrored reason input + buttons.
  test("task approval banner renders correctly in RTL", async ({ page }) => {
    const { projectId, taskId } = await createApprovalBannerFixture();
    try {
      await page.goto(`/fa-IR/tasks/${taskId}`);
      const banner = page.getByTestId("task-approval-banner").first();
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(banner).toHaveScreenshot("approval-banner-rtl.png", {
        maxDiffPixelRatio: 0.02,
      });

      // Expand the reject input — the mirrored input + buttons are the most
      // RTL-sensitive part of the banner.
      await banner.getByRole("button", { name: "رد", exact: true }).click();
      await expect(banner.getByPlaceholder("دلیل رد")).toBeVisible();
      await expect(banner).toHaveScreenshot("approval-banner-reject-rtl.png", {
        maxDiffPixelRatio: 0.02,
      });

      // Submitting the reject with an empty reason surfaces the error line,
      // which sits under the mirrored control row.
      await banner.getByRole("button", { name: "رد", exact: true }).click();
      await expect(banner.getByText("برای رد کردن، دلیل الزامی است")).toBeVisible();
      await expect(banner).toHaveScreenshot("approval-banner-error-rtl.png", {
        maxDiffPixelRatio: 0.02,
      });
    } finally {
      await cleanupApprovalBannerFixture(projectId);
    }
  });

  test("task approval banner renders correctly in LTR", async ({ page }) => {
    const { projectId, taskId } = await createApprovalBannerFixture();
    try {
      await page.goto(`/en-US/tasks/${taskId}`);
      const banner = page.getByTestId("task-approval-banner").first();
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(banner).toHaveScreenshot("approval-banner-ltr.png", {
        maxDiffPixelRatio: 0.02,
      });

      await banner.getByRole("button", { name: "Reject", exact: true }).click();
      await expect(banner.getByPlaceholder("Reason for rejection")).toBeVisible();
      await expect(banner).toHaveScreenshot("approval-banner-reject-ltr.png", {
        maxDiffPixelRatio: 0.02,
      });

      await banner.getByRole("button", { name: "Reject", exact: true }).click();
      await expect(banner.getByText("A reason is required to reject")).toBeVisible();
      await expect(banner).toHaveScreenshot("approval-banner-error-ltr.png", {
        maxDiffPixelRatio: 0.02,
      });
    } finally {
      await cleanupApprovalBannerFixture(projectId);
    }
  });

  // The mirrored views get en-US/LTR baselines too: the sticky label column,
  // dependency arrows, and column flow also have a left side that can regress.
  test("gantt chart renders correctly in LTR", async ({ page }) => {
    await mockGanttReport(page);

    const projectId = await seededProductLaunchId();
    await page.goto(`/en-US/projects/${projectId}`);
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible({ timeout: 15000 });
    await expect(chart.getByTestId("gantt-task-bar").first()).toBeVisible();
    await expect(page).toHaveScreenshot("gantt-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("gantt dependency panel renders correctly in LTR", async ({ page }) => {
    await mockGanttReport(page);

    const projectId = await seededProductLaunchId();
    await page.goto(`/en-US/projects/${projectId}`);
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    const chart = page.getByTestId("gantt-scroll-container").first();
    await expect(chart).toBeVisible({ timeout: 15000 });

    await page.getByTestId("gantt-deps-toggle").click();
    const panel = page.getByTestId("gantt-deps-panel").first();
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("gantt-dep-row")).toHaveCount(1);
    await expect(page).toHaveScreenshot("gantt-deps-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("wbs tree renders correctly in LTR", async ({ page }) => {
    await page.route("**/api/v1/projects/*/wbs**", async (route) => {
      await route.fulfill({ json: { data: WBS_RTL_TREE } });
    });

    const projectId = await seededProductLaunchId();
    await page.goto(`/en-US/projects/${projectId}`);
    await page.getByRole("button", { name: "WBS", exact: true }).click();
    const editor = page.getByTestId("wbs-editor").first();
    await expect(editor).toBeVisible({ timeout: 15000 });
    await expect(editor.getByTestId("wbs-row")).toHaveCount(4);
    await expect(page).toHaveScreenshot("wbs-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("calendar view renders correctly in LTR", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-08-19T12:00:00Z"));
    await page.route("**/api/v1/tasks**", async (route) => {
      await route.fulfill({ json: { data: CALENDAR_RTL_TASKS } });
    });
    await page.route("**/api/v1/working-days**", async (route) => {
      await route.fulfill({ json: { data: { weekendDays: [], holidays: [] } } });
    });

    await page.goto("/en-US/calendar");
    const firstCell = page.getByTestId("calendar-day").first();
    await expect(firstCell).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Design new dashboard layout")).toBeVisible();
    await expect(page).toHaveScreenshot("calendar-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("board view renders correctly in LTR", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-08-19T12:00:00Z"));

    const projectId = await seededProductLaunchId();
    await page.goto(`/en-US/projects/${projectId}`);
    await expect(page.getByText("Finalize launch checklist").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("board-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("workspace shell renders correctly in LTR", async ({ page }) => {
    await page.goto("/en-US/workspace");
    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("workspace-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("workspace shell renders correctly in RTL", async ({ page }) => {
    await page.goto("/fa-IR/workspace");
    await expect(page.getByRole("heading", { name: "فضای کاری" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("workspace-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("search page renders correctly in LTR", async ({ page }) => {
    await page.goto("/en-US/search");
    await expect(page.getByRole("textbox").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("search-ltr.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("search page renders correctly in RTL", async ({ page }) => {
    await page.goto("/fa-IR/search");
    await expect(page.getByRole("textbox").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveScreenshot("search-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ── Theme visual baselines ──────────────────────────────────────────
  // Navigate to the settings page with each named theme injected into
  // localStorage so the ThemeProvider picks it up on mount.  Screenshot
  // just the appearance section (theme buttons + accent picker) to keep
  // baselines small and independent of the rest of the settings page.

  test("appearance section renders correctly with Midnight theme", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "midnight");
    });
    await page.goto("/en-US/settings");
    const heading = page.getByRole("heading", { name: "Appearance" }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const section = heading.locator("..");
    await expect(section).toHaveScreenshot("theme-midnight.png", { maxDiffPixelRatio: 0.02 });
  });

  test("appearance section renders correctly with Solarized theme", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "solarized");
    });
    await page.goto("/en-US/settings");
    const heading = page.getByRole("heading", { name: "Appearance" }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const section = heading.locator("..");
    await expect(section).toHaveScreenshot("theme-solarized.png", { maxDiffPixelRatio: 0.02 });
  });

  test("appearance section renders correctly with High-Contrast theme", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "high_contrast");
    });
    await page.goto("/en-US/settings");
    const heading = page.getByRole("heading", { name: "Appearance" }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const section = heading.locator("..");
    await expect(section).toHaveScreenshot("theme-high-contrast.png", { maxDiffPixelRatio: 0.02 });
  });

  test("appearance section renders correctly with Nord theme", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "nord");
    });
    await page.goto("/en-US/settings");
    const heading = page.getByRole("heading", { name: "Appearance" }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const section = heading.locator("..");
    await expect(section).toHaveScreenshot("theme-nord.png", { maxDiffPixelRatio: 0.02 });
  });
});
