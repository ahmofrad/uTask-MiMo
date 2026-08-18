/**
 * Marker-aware Gantt behavior in a non-UTC runtime zone.
 *
 * The app stores date-only values as UTC day markers (starts at
 * `00:00:00.000Z`, dues at `23:59:59.999Z`). Consumers that treat those
 * markers as local instants break in zones east/west of UTC: a single-day
 * task renders as two days, and a drag by one day saves the start a day
 * behind and the due two days ahead. These tests pin the marker-aware
 * behavior in Asia/Tehran (the zone where it reproduced).
 *
 * NOTE: the runtime timezone is set before any date is constructed, so this
 * file's expectations are independent of the CI environment's TZ.
 */
process.env.TZ = "Asia/Tehran";

import { describe, expect, it } from "vitest";
import {
  applyDragDelta,
  createDragState,
  dragPatchBody,
} from "@/lib/gantt/drag";
import { getTimelineItemGeometry } from "@/lib/gantt/timeline";
import { startOfCalendarDay } from "@/lib/date/day-marker";

const DAY_WIDTH = 52;
const start = new Date("2026-08-19T00:00:00.000Z");
const due = new Date("2026-08-19T23:59:59.999Z");
const dueLater = new Date("2026-08-21T23:59:59.999Z");
const rangeStart = startOfCalendarDay(start);

describe("geometry in Asia/Tehran", () => {
  it("keeps a single-day marker task inside exactly one calendar cell", () => {
    // Before the fix the due marker fell on local Aug 20, so the bar spanned
    // two days and started at a fractional offset (03:30 local).
    const geometry = getTimelineItemGeometry(start, due, rangeStart, DAY_WIDTH);
    expect(geometry).toEqual({ startOffset: 0, width: DAY_WIDTH });
  });

  it("spans exactly the marker days for a multi-day task", () => {
    const geometry = getTimelineItemGeometry(start, dueLater, rangeStart, DAY_WIDTH);
    expect(geometry.startOffset).toBe(0);
    // Aug 19, 20, 21 → three full cells.
    expect(geometry.width).toBe(3 * DAY_WIDTH);
  });

  it("anchors a due marker to its own calendar day, not the next local day", () => {
    // The due marker is Aug 21; its timeline offset must be 2, never 3.
    const geometry = getTimelineItemGeometry(start, dueLater, rangeStart, DAY_WIDTH);
    expect(geometry.width).toBe(3 * DAY_WIDTH);
    expect(geometry.startOffset).toBe(0);
  });
});

describe("drag in Asia/Tehran", () => {
  it("moves a single-day marker task by one whole day onto correct UTC markers", () => {
    const state = createDragState("t1", "move", 100, start, due);
    const snapped = applyDragDelta(state, 1, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-20T23:59:59.999Z");
    expect(dragPatchBody(snapped)).toEqual({
      startDate: "2026-08-20T00:00:00.000Z",
      dueDate: "2026-08-20T23:59:59.999Z",
    });
  });

  it("moves a multi-day marker task by two days, preserving the span", () => {
    const state = createDragState("t1", "move", 100, start, dueLater);
    const snapped = applyDragDelta(state, 2, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-23T23:59:59.999Z");
  });

  it("detects a single-day task across the UTC marker boundary", () => {
    // isSingleDay decides resize behavior; before the fix the due marker fell
    // on the next local day so a same-day task looked multi-day.
    const state = createDragState("t1", "resize-start", 100, start, due);
    const snapped = applyDragDelta(state, 2, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-21T23:59:59.999Z");
  });

  it("resize-due grows only the due edge onto the correct marker", () => {
    const state = createDragState("t1", "resize-due", 100, start, due);
    const snapped = applyDragDelta(state, 2, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-21T23:59:59.999Z");
    expect(dragPatchBody(snapped)).toEqual({ dueDate: "2026-08-21T23:59:59.999Z" });
  });

  it("follows the pointer at the marker's timeline position mid-drag", () => {
    // The live intermediate is anchored in the runtime zone: anchor day Aug 19
    // + 1.5 cells = local Aug 20 12:00, so the bar tracks the pointer exactly
    // instead of drifting by the zone offset.
    const state = createDragState("t1", "move", 100, start, dueLater);
    const live = applyDragDelta(state, 1.5, false);
    expect(live.currentStart.toISOString()).toBe("2026-08-20T08:30:00.000Z");
    expect(live.currentEnd.toISOString()).toBe("2026-08-22T08:30:00.000Z");
    const geometry = getTimelineItemGeometry(
      live.currentStart,
      live.currentEnd,
      rangeStart,
      DAY_WIDTH,
    );
    expect(geometry.startOffset).toBeCloseTo(1.5, 4);
  });

  it("renders a single-day live drag on its cell, snapping cell-to-cell", () => {
    // Single-day bars are normalized to the calendar cell by design; the
    // intermediate still shifts the anchor day.
    const state = createDragState("t1", "move", 100, start, due);
    const live = applyDragDelta(state, 1.5, false);
    const geometry = getTimelineItemGeometry(
      live.currentStart,
      live.currentEnd,
      rangeStart,
      DAY_WIDTH,
    );
    expect(geometry.startOffset).toBe(1);
    expect(geometry.width).toBe(DAY_WIDTH);
  });
});
