import { describe, it, expect } from "vitest";
import { getRolePermissions, hasPermission } from "@/lib/rbac/roles";

const ALL_PERMISSIONS = [
  "org:manage",
  "org:settings",
  "org:reports",
  "project:create",
  "project:delete",
  "custom_field:define",
  "project_role:assign",
  "task:create",
  "task:edit_own",
  "task:edit_any",
  "comment:create",
  "audit:view",
  "data:export",
  "user:manage",
  "api_token:manage",
  "webhook:manage",
  "sso:configure",
] as const;

describe("RBAC permission matrix", () => {
  it("owner has all permissions", () => {
    const perms = getRolePermissions("owner");
    for (const p of ALL_PERMISSIONS) {
      expect(perms).toContain(p);
    }
  });

  it("admin has all except org:manage", () => {
    const perms = getRolePermissions("admin");
    const adminDenied = ["org:manage"];
    for (const p of ALL_PERMISSIONS) {
      if (adminDenied.includes(p)) {
        expect(perms).not.toContain(p);
      } else {
        expect(perms).toContain(p);
      }
    }
  });

  it("manager has project/task/comment/report perms but not audit/user/sso/webhook/org", () => {
    const perms = getRolePermissions("manager");
    const allowed = [
      "project:create",
      "custom_field:define",
      "project_role:assign",
      "task:create",
      "task:edit_own",
      "task:edit_any",
      "comment:create",
      "data:export",
      "api_token:manage",
      "org:reports",
    ];
    const denied = [
      "org:manage",
      "org:settings",
      "project:delete",
      "audit:view",
      "user:manage",
      "webhook:manage",
      "sso:configure",
    ];
    for (const p of allowed) {
      expect(perms).toContain(p);
    }
    for (const p of denied) {
      expect(perms).not.toContain(p);
    }
  });

  it("member has only task:create, task:edit_own, comment:create, api_token:manage", () => {
    const perms = getRolePermissions("member");
    const allowed = ["task:create", "task:edit_own", "comment:create", "api_token:manage"];
    const denied = ALL_PERMISSIONS.filter((p) => !allowed.includes(p));
    for (const p of allowed) {
      expect(perms).toContain(p);
    }
    for (const p of denied) {
      expect(perms).not.toContain(p);
    }
  });

  it("guest has only comment:create", () => {
    const perms = getRolePermissions("guest");
    expect(perms).toContain("comment:create");
    expect(perms).toHaveLength(1);
  });

  it("unknown role returns empty array", () => {
    expect(getRolePermissions("unknown" as never)).toEqual([]);
    expect(hasPermission("unknown" as never, "task:create")).toBe(false);
  });
});
