import { describe, it, expect } from "vitest";
import { notificationContent } from "@/lib/notifications/content";

const t = ((_key: string, _vars?: Record<string, unknown>) =>
  `${_key}:${JSON.stringify(_vars ?? {})}`) as (
  _key: string,
  _values?: Record<string, string | number | Date>,
) => string;

describe("notificationContent", () => {
  it("renders assigned with task title", () => {
    const c = notificationContent("assigned", { taskTitle: "Fix login" }, t);
    expect(c.title).toContain("assignedTitle");
    expect(c.body).toContain("assignedBody");
  });

  it("falls back to legacy message payload for assigned", () => {
    const c = notificationContent("assigned", { message: "old text" }, t);
    expect(c.body).toBe("old text");
  });

  it("renders mentioned with actor", () => {
    const c = notificationContent("mentioned", { taskTitle: "X", by: "Sara" }, t);
    expect(c.title).toContain("mentionedTitle");
    expect(c.body).toContain("mentionedBody");
  });

  it("defaults unknown types to a spaced label", () => {
    const c = notificationContent("some_event", null, t);
    expect(c.title).toBe("some event");
  });

  it("renders department link requests", () => {
    const c = notificationContent("department_link_request", { departmentName: "Engineering", projectName: "Roadmap" }, t);
    expect(c.title).toContain("departmentLinkRequestTitle");
    expect(c.body).toContain("departmentLinkRequestBody");
  });
});
