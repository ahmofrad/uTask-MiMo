import { describe, it, expect } from "vitest";
import { buildGanttExportSvg, FALLBACK_PALETTE } from "@/lib/gantt/export-svg";
import type { GanttReport } from "@/lib/gantt-types";

describe("pure export module", () => {
  it("imports without a DOM (no document/window at module scope)", () => {
    // The module-level default palette is static; the browser adapter owns
    // resolveExportPalette. Importing the pure module must not require jsdom.
    expect(FALLBACK_PALETTE.fgPrimary).toBe("#17213b");
    expect(typeof buildGanttExportSvg).toBe("function");
  });

  it("falls back to the static palette when none is passed", () => {
    const svg = buildGanttExportSvg({ report, locale: "en-US" });
    expect(svg).toContain(FALLBACK_PALETTE.fgPrimary);
  });
});

const report: GanttReport = {
  tasks: [
    {
      id: "t1",
      title: "Design <schema> & API",
      wbsCode: "1.1",
      parentTaskId: null,
      depth: 0,
      isSummary: false,
      isMilestone: false,
      status: "in_progress",
      progress: 40,
      startDate: "2026-08-10T00:00:00.000Z",
      dueDate: "2026-08-14T00:00:00.000Z",
      critical: true,
    },
    {
      id: "t2",
      title: "Ship v1",
      wbsCode: "1.2",
      parentTaskId: null,
      depth: 0,
      isSummary: false,
      isMilestone: true,
      status: "open",
      progress: 0,
      startDate: "2026-08-15T00:00:00.000Z",
      dueDate: null,
    },
  ],
  links: [
    { id: "l1", source: "t1", target: "t2", type: "FINISH_TO_START", lag: 0, lagUnit: "DAY" },
  ],
  criticalChain: ["t1"],
  scheduleVersion: 1,
  project: { start: "2026-08-10T00:00:00.000Z", end: "2026-08-15T00:00:00.000Z" },
};

describe("buildGanttExportSvg", () => {
  it("renders a self-contained SVG with header, rows, bars and arrows", () => {
    const svg = buildGanttExportSvg({ report, locale: "en-US", palette: FALLBACK_PALETTE });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    // Task labels are present.
    expect(svg).toContain("Design");
    expect(svg).toContain("Ship v1");
    // Status fills are resolved to literal colors (no var() references).
    expect(svg).toContain(FALLBACK_PALETTE.warning);
    expect(svg).not.toContain("var(");
    // A dependency arrow with its FS label is drawn.
    expect(svg).toContain("marker-end=\"url(#gantt-arrow)\"");
    expect(svg).toContain(">FS</text>");
    // The critical task carries the danger stroke.
    expect(svg).toContain(`stroke="${FALLBACK_PALETTE.danger}" stroke-width="2"`);
  });

  it("escapes XML in task titles", () => {
    const svg = buildGanttExportSvg({ report, locale: "en-US", palette: FALLBACK_PALETTE });
    expect(svg).toContain("Design &lt;schema&gt; &amp; API");
    expect(svg).not.toContain("<schema>");
  });

  it("renders a milestone as a diamond polygon", () => {
    const svg = buildGanttExportSvg({ report, locale: "en-US", palette: FALLBACK_PALETTE });
    expect(svg).toContain("<polygon points=");
  });

  it("includes both calendar months in the header", () => {
    const svg = buildGanttExportSvg({ report, locale: "en-US", palette: FALLBACK_PALETTE });
    // Aug 2026 spans two Jalali months (Mordad/Shahrivar or their en names).
    expect(svg.match(/<text x="[^"]+" y="24"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("honors an explicit date range for the timeline", () => {
    // Without a range the span is padded (-7/+90 days) around the task dates;
    // with one, the timeline is exactly the requested window: 31 days of Aug
    // 2026 * 52px + 288px left column = 1900px wide.
    const svg = buildGanttExportSvg({
      report,
      locale: "en-US",
      palette: FALLBACK_PALETTE,
      rangeStart: new Date("2026-08-01T00:00:00Z"),
      rangeEnd: new Date("2026-08-31T00:00:00Z"),
    });
    expect(svg).toContain('width="1900"');
    // August always spans exactly two Jalali months, so two header blocks.
    expect(svg.match(/<text x="[^"]+" y="24"/g)?.length ?? 0).toBe(2);
  });

  it("shades weekends and holidays in the header when a working-day calendar is provided", () => {
    const svg = buildGanttExportSvg({
      report,
      locale: "en-US",
      palette: FALLBACK_PALETTE,
      rangeStart: new Date("2026-08-01T00:00:00Z"),
      rangeEnd: new Date("2026-08-31T00:00:00Z"),
      workingDays: {
        weekendDays: [6], // Saturday only
        holidays: [{ date: "2026-08-14", name: "Independence Day" }],
      },
    });
    // The holiday's header cell uses the warning background; the Saturday
    // cells use the surface-2 tint. Row shading also references both fills.
    expect(svg).toContain(`fill="${FALLBACK_PALETTE.warningBg}"`);
    expect(svg.match(new RegExp(`fill="${FALLBACK_PALETTE.warningBg}"`, "g"))?.length ?? 0).toBeGreaterThan(1);
    expect(svg).toContain(`fill="${FALLBACK_PALETTE.bgSurface2}"`);
  });

  it("uses the configured weekend (not the locale default) when provided", () => {
    // Without a calendar, the en-US locale default is Sat+Sun (both shaded
    // with bgSurface2). With weekendDays: [1] only Monday is shaded.
    const svg = buildGanttExportSvg({
      report,
      locale: "en-US",
      palette: FALLBACK_PALETTE,
      rangeStart: new Date("2026-08-01T00:00:00Z"),
      rangeEnd: new Date("2026-08-31T00:00:00Z"),
      workingDays: { weekendDays: [1], holidays: [] },
    });
    // Mondays in Aug 2026: 3, 10, 17, 24, 31 → 5 header cells + 5 row cells.
    const headerTints = svg.match(new RegExp(`fill="${FALLBACK_PALETTE.bgSurface2}"`, "g")) ?? [];
    expect(headerTints.length).toBeGreaterThanOrEqual(10);
  });
});
