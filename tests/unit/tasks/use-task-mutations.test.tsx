// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api-fetch", () => ({ apiFetch }));

import { useTaskMutations, computeDuration, addDurationToDate } from "@/hooks/use-task-mutations";

const task = {
  id: "t1",
  title: "Build API",
  description: null,
  status: "open" as const,
  priority: "med" as const,
  startDate: "2026-08-19T00:00:00.000Z",
  endDate: "2026-08-21T00:00:00.000Z",
  dueDate: null,
  estimatedHours: null,
  spentHours: null,
  projectId: "p1",
  projectName: "Work",
  assignees: [] as { id: string; displayName: string; avatarUrl?: string | null }[],
  assigneeGroup: null,
  reporter: null,
  tags: [] as { id: string; name: string }[],
  subtasks: [] as { id: string; title: string; status: string; priority: string; assignees: { id: string; displayName: string; avatarUrl?: string | null }[] }[],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const toast = vi.fn();
const t = vi.fn((key: string) => key);

function setup() {
  const api: ReturnType<typeof useTaskMutations> = {} as never;
  function Harness() {
    Object.assign(api, useTaskMutations({
      initialTask: task,
      initialComments: [],
      initialWatchers: [],
      initialAttachments: [],
      initialSubtasks: [],
      initialCFValues: {},
      initialTagIds: [],
      projectMembers: [],
      currentUserId: "u1",
      onAuditRefresh: vi.fn().mockResolvedValue(undefined),
      addToast: toast,
      t: t as never,
    }));
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness />));
  return { api, root, container };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeDuration", () => {
  it("computes days and hours between two timestamps", () => {
    expect(computeDuration("2026-08-19T00:00:00.000Z", "2026-08-21T12:00:00.000Z")).toEqual({ days: 2, hours: 12 });
  });

  it("returns zero for inverted ranges", () => {
    expect(computeDuration("2026-08-21T00:00:00.000Z", "2026-08-19T00:00:00.000Z")).toEqual({ days: 0, hours: 0 });
  });
});

describe("addDurationToDate", () => {
  it("adds days and hours to a timestamp", () => {
    expect(addDurationToDate("2026-08-19T00:00:00.000Z", 2, 4)).toBe("2026-08-21T04:00:00.000Z");
  });
});

describe("useTaskMutations", () => {
  it("optimistically updates the task on updateTask and patches the server", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { title: "Build API v2" } }),
    });
    const { api } = setup();
    expect(api.task.title).toBe("Build API");

    await act(async () => {
      await api.updateTask({ title: "Build API v2" });
    });

    expect(api.task.title).toBe("Build API v2");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/tasks/t1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Build API v2" }),
    });
  });

  it("normalizes date-only values to UTC day markers before patching", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { startDate: "2026-08-20T00:00:00.000Z" } }),
    });
    const { api } = setup();

    await act(async () => {
      await api.updateTask({ startDate: "2026-08-20" });
    });

    const body = JSON.parse(String(apiFetch.mock.calls[0]?.[1]?.body)) as Record<string, string>;
    expect(body.startDate).toBe("2026-08-20T00:00:00.000Z");
  });

  it("adds a comment to the local list after a successful POST", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: "c1",
          bodyMarkdown: "Hello",
          createdAt: "2026-08-19T10:00:00.000Z",
          authorId: "u1",
          author: { displayName: "Ali", avatarUrl: null },
        },
      }),
    });
    const { api } = setup();

    await act(async () => {
      await api.addComment("Hello");
    });

    expect(api.comments).toHaveLength(1);
    expect(api.comments[0]?.body).toBe("Hello");
  });

  it("toggles watch state without a server round-trip when already watching", async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // add watcher
    apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // toggle off
    const { api } = setup();
    // Seed the watcher list through the returned handler.
    await act(async () => {
      await api.handleAddWatcher("u1");
    });
    expect(api.isWatching).toBe(true);

    await act(async () => {
      await api.toggleWatch();
    });
    expect(api.isWatching).toBe(false);
    expect(apiFetch).toHaveBeenLastCalledWith("/api/v1/watchers/tasks/t1", { method: "DELETE" });
  });

  it("offers an undo toast when the server reports auto-scheduled changes", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          title: "Build API",
          autoScheduled: [{ id: "t2", startDate: "2026-08-22T00:00:00.000Z", dueDate: "2026-08-23T00:00:00.000Z" }],
        },
      }),
    });
    const { api } = setup();

    await act(async () => {
      await api.updateTask({ startDate: "2026-08-20" });
    });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: "task.autoScheduledToast" }));
  });

  it("keeps the initial duration when the task has start and end dates", () => {
    const { api } = setup();
    expect(api.durationDays).toBe(2);
    expect(api.durationHours).toBe(0);
  });

  it("rolls back custom-field values when the PATCH fails", async () => {
    apiFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const { api } = setup();

    await act(async () => {
      await api.handleCustomFieldChange("priority_level", "high");
    });

    expect(api.cfValues).toEqual({});
  });
});
