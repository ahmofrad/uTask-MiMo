import { describe, it, expect } from "vitest";
import { getRolePermissions, hasPermission } from "@/lib/rbac/roles";

const ROLES = ["owner", "admin", "manager", "member", "guest"] as const;

const ALL_ACTIONS = [
  "org:manage",
  "org:settings",
  "org:reports",
  "project:create",
  "project:update",
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
  "group:manage",
] as const;

describe("RBAC comprehensive", () => {
  describe("hasPermission", () => {
    it("owner has every permission", () => {
      for (const action of ALL_ACTIONS) {
        expect(hasPermission("owner", action)).toBe(true);
      }
    });

    it("guest has only comment:create permission", () => {
      expect(hasPermission("guest", "comment:create")).toBe(true);
      expect(hasPermission("guest", "org:manage")).toBe(false);
      expect(hasPermission("guest", "task:create")).toBe(false);
    });

    it("unknown role has no permissions", () => {
      for (const action of ALL_ACTIONS) {
        expect(hasPermission("nonexistent" as never, action)).toBe(false);
      }
    });

    it("member can create tasks and comments", () => {
      expect(hasPermission("member", "task:create")).toBe(true);
      expect(hasPermission("member", "comment:create")).toBe(true);
    });

    it("member cannot manage org or users", () => {
      expect(hasPermission("member", "org:manage")).toBe(false);
      expect(hasPermission("member", "user:manage")).toBe(false);
      expect(hasPermission("member", "webhook:manage")).toBe(false);
    });

    it("manager can create projects but not manage org", () => {
      expect(hasPermission("manager", "project:create")).toBe(true);
      expect(hasPermission("manager", "org:manage")).toBe(false);
    });

    it("admin can manage users and webhooks but not org:manage", () => {
      expect(hasPermission("admin", "user:manage")).toBe(true);
      expect(hasPermission("admin", "webhook:manage")).toBe(true);
      expect(hasPermission("admin", "org:manage")).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("returns a non-empty array for each role", () => {
      for (const role of ROLES) {
        const perms = getRolePermissions(role);
        expect(Array.isArray(perms)).toBe(true);
        if (role !== "guest") {
          expect(perms.length).toBeGreaterThan(0);
        }
      }
    });

    it("owner permissions is a superset of admin permissions", () => {
      const ownerPerms = getRolePermissions("owner");
      const adminPerms = getRolePermissions("admin");
      for (const perm of adminPerms) {
        expect(ownerPerms).toContain(perm);
      }
    });

    it("admin permissions is a superset of member permissions", () => {
      const adminPerms = getRolePermissions("admin");
      const memberPerms = getRolePermissions("member");
      for (const perm of memberPerms) {
        expect(adminPerms).toContain(perm);
      }
    });

    it("guest has only comment:create permission", () => {
      expect(getRolePermissions("guest")).toEqual(["comment:create"]);
    });
  });
});
