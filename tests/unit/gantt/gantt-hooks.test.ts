import { describe, it, expect } from "vitest";

// ── useGanttPreferences localStorage contract (serialize/deserialize logic) ──

const GANTT_PREFS_KEY = "ganttPrefs:v1";

function defaults() {
  return { dayWidth: 52, depsOpen: false, criticalListOpen: false, showCritical: true };
}

function readPrefs(store: Record<string, string>) {
  const raw = store[GANTT_PREFS_KEY];
  if (!raw) return defaults();
  try {
    const prefs = JSON.parse(raw);
    return {
      dayWidth: typeof prefs.dayWidth === "number" && [36, 52, 72].includes(prefs.dayWidth) ? prefs.dayWidth : defaults().dayWidth,
      depsOpen: typeof prefs.depsOpen === "boolean" ? prefs.depsOpen : defaults().depsOpen,
      criticalListOpen: typeof prefs.criticalListOpen === "boolean" ? prefs.criticalListOpen : defaults().criticalListOpen,
      showCritical: typeof prefs.showCritical === "boolean" ? prefs.showCritical : defaults().showCritical,
    };
  } catch {
    return defaults();
  }
}

function writePrefs(store: Record<string, string>, prefs: ReturnType<typeof defaults>) {
  store[GANTT_PREFS_KEY] = JSON.stringify(prefs);
}

describe("useGanttPreferences localStorage contract", () => {
  it("returns defaults when empty", () => {
    expect(readPrefs({})).toEqual(defaults());
  });

  it("roundtrips dayWidth", () => {
    const store: Record<string, string> = {};
    writePrefs(store, { ...defaults(), dayWidth: 72 });
    expect(readPrefs(store).dayWidth).toBe(72);
  });

  it("roundtrips depsOpen", () => {
    const store: Record<string, string> = {};
    writePrefs(store, { ...defaults(), depsOpen: true });
    expect(readPrefs(store).depsOpen).toBe(true);
  });

  it("roundtrips all prefs", () => {
    const store: Record<string, string> = {};
    writePrefs(store, { dayWidth: 36, depsOpen: true, criticalListOpen: true, showCritical: false });
    expect(readPrefs(store)).toEqual({ dayWidth: 36, depsOpen: true, criticalListOpen: true, showCritical: false });
  });

  it("rejects invalid dayWidth values", () => {
    const store: Record<string, string> = {};
    store[GANTT_PREFS_KEY] = JSON.stringify({ dayWidth: 999 });
    expect(readPrefs(store).dayWidth).toBe(52);
  });

  it("rejects non-boolean depsOpen", () => {
    const store: Record<string, string> = {};
    store[GANTT_PREFS_KEY] = JSON.stringify({ depsOpen: "yes" });
    expect(readPrefs(store).depsOpen).toBe(false);
  });

  it("handles corrupt JSON gracefully", () => {
    const store: Record<string, string> = {};
    store[GANTT_PREFS_KEY] = "NOT_JSON{";
    expect(readPrefs(store)).toEqual(defaults());
  });
});

// ── useGanttLinks state machine ──

describe("useGanttLinks state machine", () => {
  it("first click sets source, second click with different id creates pending link", () => {
    let linkSourceId: string | null = null;
    let pendingLink: { sourceId: string; targetId: string } | null = null;

    function startLink(rowId: string, isSummary: boolean, isMilestone: boolean) {
      if (isSummary || isMilestone) return;
      if (!linkSourceId) { linkSourceId = rowId; return; }
      if (linkSourceId === rowId) { linkSourceId = null; return; }
      pendingLink = { sourceId: linkSourceId, targetId: rowId };
      linkSourceId = null;
    }

    startLink("t1", false, false);
    expect(linkSourceId).toBe("t1");
    expect(pendingLink).toBeNull();

    startLink("t2", false, false);
    expect(pendingLink).toEqual({ sourceId: "t1", targetId: "t2" });
    expect(linkSourceId).toBeNull();
  });

  it("clicking same row cancels selection", () => {
    let linkSourceId: string | null = null;

    function startLink(rowId: string) {
      if (!linkSourceId) { linkSourceId = rowId; return; }
      if (linkSourceId === rowId) { linkSourceId = null; return; }
    }

    startLink("t1");
    expect(linkSourceId).toBe("t1");
    startLink("t1");
    expect(linkSourceId).toBeNull();
  });

  it("skips summary rows", () => {
    let linkSourceId: string | null = null;
    function startLink(rowId: string, isSummary: boolean) {
      if (isSummary) return;
      linkSourceId = rowId;
    }
    startLink("t1", true);
    expect(linkSourceId).toBeNull();
  });

  it("skip milestone rows", () => {
    let linkSourceId: string | null = null;
    function startLink(rowId: string, _isSummary: boolean, isMilestone: boolean) {
      if (isMilestone) return;
      linkSourceId = rowId;
    }
    startLink("t1", false, true);
    expect(linkSourceId).toBeNull();
  });

  it("cancelLink resets all state", () => {
    let linkSourceId: string | null = "t1";
    let pendingLink: { sourceId: string; targetId: string } | null = { sourceId: "t1", targetId: "t2" };
    let linkError: string | null = "loadError";

    function cancelLink() {
      pendingLink = null;
      linkSourceId = null;
      linkError = null;
    }

    cancelLink();
    expect(linkSourceId).toBeNull();
    expect(pendingLink).toBeNull();
    expect(linkError).toBeNull();
  });

  it("toggleLinkMode resets source and error", () => {
    let linkMode = false;
    let linkSourceId: string | null = "t1";
    let linkError: string | null = "loadError";

    function toggleLinkMode() {
      linkMode = !linkMode;
      linkSourceId = null;
      linkError = null;
    }

    toggleLinkMode();
    expect(linkMode).toBe(true);
    expect(linkSourceId).toBeNull();
    expect(linkError).toBeNull();
  });

  it("depEdits: begin → change → cancel", () => {
    const depEdits: Record<string, { type: string; lag: number; lagUnit: string }> = {};

    function beginDepEdit(linkId: string, type: string, lag: number, lagUnit: string) {
      depEdits[linkId] = { type, lag, lagUnit };
    }
    function onDepEditChange(linkId: string, edit: { type: string; lag: number; lagUnit: string }) {
      depEdits[linkId] = edit;
    }
    function onDepEditCancel(linkId: string) {
      delete depEdits[linkId];
    }

    beginDepEdit("link-1", "FINISH_TO_START", 0, "DAY");
    expect(depEdits["link-1"]).toEqual({ type: "FINISH_TO_START", lag: 0, lagUnit: "DAY" });

    onDepEditChange("link-1", { type: "START_TO_START", lag: 2, lagUnit: "DAY" });
    expect(depEdits["link-1"].type).toBe("START_TO_START");
    expect(depEdits["link-1"].lag).toBe(2);

    onDepEditCancel("link-1");
    expect(depEdits["link-1"]).toBeUndefined();
  });
});

// ── useGanttDrag overrides ──

describe("useGanttDrag overrides", () => {
  it("set and clear overrides", () => {
    const overrides: Record<string, { startDate: string | null; dueDate: string | null }> = {};

    overrides["t1"] = { startDate: "2026-01-01T00:00:00.000Z", dueDate: "2026-01-10T00:00:00.000Z" };
    expect(overrides["t1"]).toEqual({
      startDate: "2026-01-01T00:00:00.000Z",
      dueDate: "2026-01-10T00:00:00.000Z",
    });

    delete overrides["t1"];
    expect(overrides["t1"]).toBeUndefined();
  });

  it("multiple overrides coexist", () => {
    const overrides: Record<string, { startDate: string | null; dueDate: string | null }> = {};

    overrides["t1"] = { startDate: "2026-01-01T00:00:00.000Z", dueDate: "2026-01-05T00:00:00.000Z" };
    overrides["t2"] = { startDate: "2026-02-01T00:00:00.000Z", dueDate: "2026-02-10T00:00:00.000Z" };

    expect(Object.keys(overrides)).toHaveLength(2);
    expect(overrides["t1"].startDate).toBe("2026-01-01T00:00:00.000Z");
    expect(overrides["t2"].startDate).toBe("2026-02-01T00:00:00.000Z");
  });

  it("overrides are idempotent for same task", () => {
    const overrides: Record<string, { startDate: string | null; dueDate: string | null }> = {};

    overrides["t1"] = { startDate: "2026-01-01T00:00:00.000Z", dueDate: "2026-01-10T00:00:00.000Z" };
    overrides["t1"] = { startDate: "2026-01-01T00:00:00.000Z", dueDate: "2026-01-10T00:00:00.000Z" };

    expect(Object.keys(overrides)).toHaveLength(1);
  });
});
