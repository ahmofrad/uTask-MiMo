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

  it("renders a legacy Tehran-midnight marker on its intended calendar day", () => {
    // Legacy data stored day markers as Asia/Tehran local midnights:
    // 2026-08-24T20:30:00Z is midnight Aug 25 in Tehran, and
    // 2026-08-27T20:29:59.999Z is 23:59:59.999 local on Aug 27. The bar must
    // sit on cells 6..8 (Aug 25..27), three cells wide — never on the raw UTC
    // day (Aug 24) nor spanning the wrong count.
    const legacyStart = new Date("2026-08-24T20:30:00.000Z");
    const legacyDue = new Date("2026-08-27T20:29:59.999Z");
    const geometry = getTimelineItemGeometry(legacyStart, legacyDue, rangeStart, DAY_WIDTH);
    expect(geometry.startOffset).toBe(6);
    expect(geometry.width).toBe(3 * DAY_WIDTH);
  });

  it("renders a legacy single-day task as exactly one cell", () => {
    // Midnight Aug 25 (start) through 23:59:59.999 local Aug 25 (due).
    const legacyStart = new Date("2026-08-24T20:30:00.000Z");
    const legacyDue = new Date("2026-08-25T20:29:59.999Z");
    const geometry = getTimelineItemGeometry(legacyStart, legacyDue, rangeStart, DAY_WIDTH);
    expect(geometry.startOffset).toBe(6);
    expect(geometry.width).toBe(DAY_WIDTH);
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

  it("moves a marker task cell-to-cell mid-drag with a stable span", () => {
    // The live intermediate is a canonical marker pair (whole-day rounding),
    // so the bar never renders at fractional sub-day positions — which
    // oscillated the width between N and N+1 cells at whole-day boundaries
    // and made the bar leap in RTL. The live span equals the released span.
    const state = createDragState("t1", "move", 100, start, dueLater);
    const live = applyDragDelta(state, 1.5, false);
    expect(live.currentStart.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    expect(live.currentEnd.toISOString()).toBe("2026-08-23T23:59:59.999Z");
    const geometry = getTimelineItemGeometry(
      live.currentStart,
      live.currentEnd,
      rangeStart,
      DAY_WIDTH,
    );
    expect(geometry.startOffset).toBe(2);
    expect(geometry.width).toBe(3 * DAY_WIDTH);
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
    expect(geometry.startOffset).toBe(2);
    expect(geometry.width).toBe(DAY_WIDTH);
  });

  it("drags a legacy Tehran-midnight task onto canonical markers one day later", () => {
    // The regression the user hit: dragging a legacy task anchored on its raw
    // UTC day, saving a date one day short of the intended day. The drag must
    // anchor on the normalized (intended) day and persist canonical markers.
    const legacyStart = new Date("2026-08-24T20:30:00.000Z"); // Aug 25 in Tehran
    const legacyDue = new Date("2026-08-27T20:29:59.999Z"); // Aug 27 in Tehran
    const state = createDragState("t1", "move", 100, legacyStart, legacyDue);
    const snapped = applyDragDelta(state, 1, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-28T23:59:59.999Z");
    expect(dragPatchBody(snapped)).toEqual({
      startDate: "2026-08-26T00:00:00.000Z",
      dueDate: "2026-08-28T23:59:59.999Z",
    });
  });
});
