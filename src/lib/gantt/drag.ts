import { isSameCalendarDay } from "@/lib/date/day-marker";
import { shiftTimelineDateByDays, snapTimelineDate } from "@/lib/gantt/timeline";

export type DragMode = "move" | "resize-start" | "resize-due";

export type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  origStart: Date;
  origEnd: Date;
  currentStart: Date;
  currentEnd: Date;
  lastDeltaDays: number;
};

/** Create the initial drag state from a pointer-down on a task bar. */
export function createDragState(
  id: string,
  mode: DragMode,
  startX: number,
  origStart: Date,
  origEnd: Date | null,
): DragState {
  const end = origEnd ?? origStart;
  return {
    id,
    mode,
    startX,
    origStart,
    origEnd: end,
    currentStart: origStart,
    currentEnd: end,
    lastDeltaDays: 0,
  };
}

/**
 * Move a drag's start/end by a pointer delta. With `snap` false (live drag)
 * the dates keep their time-of-day so the bar follows the pointer
 * continuously, including within a day; with `snap` true (release) the dates
 * are pinned to whole calendar days so the saved values land exactly on
 * timeline cells.
 */
export function applyDragDelta(
  state: DragState,
  deltaDays: number,
  snap: boolean,
): DragState {
  const isSingleDay = isSameCalendarDay(state.origStart, state.origEnd);
  const shift = (date: Date, boundary: "start" | "end") => {
    const shifted = shiftTimelineDateByDays(date, deltaDays);
    return snap ? snapTimelineDate(shifted, boundary) : shifted;
  };
  let ns = state.origStart;
  let ne = state.origEnd;
  if (state.mode === "move") {
    ns = shift(state.origStart, "start");
    ne = shift(state.origEnd, "end");
  } else if (state.mode === "resize-start") {
    ns = shift(state.origStart, "start");
    if (isSingleDay && deltaDays > 0) {
      ne = shift(state.origEnd, "end");
    } else if (ns > state.origEnd) {
      ns = snap ? snapTimelineDate(state.origEnd, "start") : state.origEnd;
    }
  } else {
    ne = shift(state.origEnd, "end");
    if (isSingleDay && deltaDays < 0) {
      ns = shift(state.origStart, "start");
    } else if (ne < state.origStart) {
      ne = snap ? snapTimelineDate(state.origStart, "end") : state.origStart;
    }
  }
  return { ...state, currentStart: ns, currentEnd: ne, lastDeltaDays: deltaDays };
}

/** Whole-day delta after release — zero means the bar never actually moved. */
export function roundedDragDelta(state: DragState): number {
  return Math.round(state.lastDeltaDays);
}

export type DragPatch =
  | { startDate: string; dueDate: string }
  | { startDate: string }
  | { dueDate: string };

/**
 * The PATCH body that persists the release state. `move` always writes both
 * bounds; a resize writes only the edge that was dragged (or both when a
 * single-day task resizes across its original day).
 */
export function dragPatchBody(state: DragState): DragPatch {
  const startChanged = state.currentStart.getTime() !== state.origStart.getTime();
  const dueChanged = state.currentEnd.getTime() !== state.origEnd.getTime();
  if (state.mode === "move" || (startChanged && dueChanged)) {
    return {
      startDate: state.currentStart.toISOString(),
      dueDate: state.currentEnd.toISOString(),
    };
  }
  if (state.mode === "resize-start") {
    return { startDate: state.currentStart.toISOString() };
  }
  return { dueDate: state.currentEnd.toISOString() };
}
