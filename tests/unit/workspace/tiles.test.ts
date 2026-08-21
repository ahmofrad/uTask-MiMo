import { describe, it, expect } from "vitest";
import { buildWorkspaceTiles } from "@/lib/workspace/tiles";

describe("buildWorkspaceTiles", () => {
  it("returns the core module tiles for every user", () => {
    const hrefs = buildWorkspaceTiles(false).map((t) => t.href);
    expect(hrefs).toEqual(["/", "/my-tasks", "/projects", "/calendar", "/all", "/settings"]);
  });

  it("hides the admin-only insights tile for non-admins", () => {
    const hrefs = buildWorkspaceTiles(false).map((t) => t.href);
    expect(hrefs).not.toContain("/admin/insights");
  });

  it("includes the insights tile for admins", () => {
    const hrefs = buildWorkspaceTiles(true).map((t) => t.href);
    expect(hrefs).toContain("/admin/insights");
  });

  it("keeps stable ordering so the shell layout is deterministic", () => {
    const order = buildWorkspaceTiles(true).map((t) => t.href);
    expect(order).toEqual(["/", "/my-tasks", "/projects", "/calendar", "/all", "/admin/insights", "/settings"]);
  });
});
