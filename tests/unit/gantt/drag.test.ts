import { describe, expect, it } from "vitest";
import {
  applyDragDelta,
  createDragState,
  dragPatchBody,
  roundedDragDelta,
} from "@/lib/gantt/drag";

const start = new Date("2026-08-19T00:00:00.000Z");
const end = new Date("2026-08-21T00:00:00.000Z");

describe("createDragState", () => {
  it("captures the pointer origin and the task bounds", () => {
    const state = createDragState("t1", "move", 100, start, end);
    expect(state.id).toBe("t1");
    expect(state.mode).toBe("move");
    expect(state.startX).toBe(100);
    expect(state.origStart).toEqual(start);
    expect(state.origEnd).toEqual(end);
    expect(state.currentStart).toEqual(start);
    expect(state.currentEnd).toEqual(end);
    expect(state.lastDeltaDays).toBe(0);
  });

  it("falls back to the start when a task has no end", () => {
    const state = createDragState("t1", "move", 100, start, null);
    expect(state.origEnd).toEqual(start);
    expect(state.currentEnd).toEqual(start);
  });
});

describe("applyDragDelta — move", () => {
  it("snaps a whole-day move onto calendar day boundaries", () => {
    const state = createDragState("t1", "move", 100, start, end);
    const snapped = applyDragDelta(state, 2, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    // The due edge snaps to the end-of-day marker, per the day-marker
    // convention for stored date-only dues.
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-23T23:59:59.999Z");
    expect(snapped.lastDeltaDays).toBe(2);
  });

  it("follows the pointer continuously without snapping mid-drag", () => {
    const state = createDragState("t1", "move", 100, start, end);
    const live = applyDragDelta(state, 1.5, false);
    // Preserves time-of-day so the bar follows the pointer within a day.
    expect(live.currentStart.getTime()).toBe(start.getTime() + 1.5 * 24 * 60 * 60 * 1000);
    expect(live.currentEnd.getTime()).toBe(end.getTime() + 1.5 * 24 * 60 * 60 * 1000);
  });

  it("keeps the original bounds untouched", () => {
    const state = createDragState("t1", "move", 100, start, end);
    const snapped = applyDragDelta(state, 2, true);
    expect(snapped.origStart).toEqual(start);
    expect(snapped.origEnd).toEqual(end);
  });
});

describe("applyDragDelta — resize", () => {
  it("resize-start moves only the start edge", () => {
    const state = createDragState("t1", "resize-start", 100, start, end);
    const snapped = applyDragDelta(state, 1, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-21T00:00:00.000Z");
  });

  it("resize-due moves only the due edge", () => {
    const state = createDragState("t1", "resize-due", 100, start, end);
    const snapped = applyDragDelta(state, 1, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-22T23:59:59.999Z");
  });

  it("a single-day task dragged right via resize-start grows the end too", () => {
    // origEnd equals origStart for a single-day task, so both bounds shift by
    // the same delta: the start lands on the new day's midnight and the end
    // on the same new day's end-of-day marker.
    const state = createDragState("t1", "resize-start", 100, start, start);
    const snapped = applyDragDelta(state, 2, true);
    expect(snapped.currentStart.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    expect(snapped.currentEnd.toISOString()).toBe("2026-08-21T23:59:59.999Z");
  });

  it("resize-start clamps at the end edge", () => {
    const state = createDragState("t1", "resize-start", 100, start, end);
    const snapped = applyDragDelta(state, 5, true);
    expect(snapped.currentStart.getTime()).toBeLessThanOrEqual(snapped.currentEnd.getTime());
  });
});

describe("roundedDragDelta", () => {
  it("rounds the raw pointer delta to whole days", () => {
    const state = createDragState("t1", "move", 100, start, end);
    expect(roundedDragDelta(applyDragDelta(state, 0.4, false))).toBe(0);
    expect(roundedDragDelta(applyDragDelta(state, 1.5, false))).toBe(2);
    expect(roundedDragDelta(applyDragDelta(state, -0.6, false))).toBe(-1);
  });
});

describe("dragPatchBody", () => {
  it("writes both bounds for a move", () => {
    const state = applyDragDelta(createDragState("t1", "move", 100, start, end), 1, true);
    expect(dragPatchBody(state)).toEqual({
      startDate: "2026-08-20T00:00:00.000Z",
      dueDate: "2026-08-22T23:59:59.999Z",
    });
  });

  it("writes only the dragged edge for a resize", () => {
    const startEdge = applyDragDelta(createDragState("t1", "resize-start", 100, start, end), 1, true);
    expect(dragPatchBody(startEdge)).toEqual({ startDate: "2026-08-20T00:00:00.000Z" });

    const dueEdge = applyDragDelta(createDragState("t1", "resize-due", 100, start, end), 1, true);
    expect(dragPatchBody(dueEdge)).toEqual({ dueDate: "2026-08-22T23:59:59.999Z" });
  });

  it("writes both bounds when a single-day task resizes across its day", () => {
    const state = applyDragDelta(createDragState("t1", "resize-start", 100, start, start), 2, true);
    const body = dragPatchBody(state) as { startDate: string; dueDate: string };
    expect(body.startDate).toBeDefined();
    expect(body.dueDate).toBeDefined();
  });
});
