export type RoleType = "owner" | "admin" | "manager" | "member" | "guest";

export type Permission =
  | "org:manage"
  | "org:settings"
  | "project:create"
  | "project:delete"
  | "custom_field:define"
  | "project_role:assign"
  | "task:create"
  | "task:edit_own"
  | "task:edit_any"
  | "comment:create"
  | "audit:view"
  | "data:export"
  | "user:manage"
  | "api_token:manage"
  | "webhook:manage"
  | "sso:configure"
  | "org:reports"
  | "settings:update";

const PERMISSION_MATRIX: Record<RoleType, Permission[]> = {
  owner: [
    "org:manage",
    "org:settings",
    "org:reports",
    "settings:update",
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
  ],
  admin: [
    "org:settings",
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
    "org:reports",
    "settings:update",
  ],
  manager: [
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
    "settings:update",
  ],
  member: [
    "task:create",
    "task:edit_own",
    "comment:create",
    "api_token:manage",
    "settings:update",
  ],
  guest: [
    "comment:create",
  ],
};

export function getRolePermissions(role: RoleType): Permission[] {
  return PERMISSION_MATRIX[role] ?? [];
}

export function hasPermission(role: RoleType, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}
