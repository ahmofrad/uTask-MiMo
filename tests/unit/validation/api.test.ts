import { describe, expect, it } from "vitest";
import {
  dependencyCreateSchema,
  departmentCreateSchema,
  departmentUpdateSchema,
  commentUpdateSchema,
  attachmentUpdateSchema,
  moveTaskSchema,
  projectCreateSchema,
  projectUpdateSchema,
  projectMemberCreateSchema,
  projectMemberUpdateSchema,
  ldapSettingsUpdateSchema,
  readJsonBody,
  reorderTasksSchema,
  subtaskCreateSchema,
  subtaskUpdateSchema,
  tagCreateSchema,
  tagUpdateSchema,
  userCreateSchema,
  userRoleUpdateSchema,
  userUpdateSchema,
  publicWebhookUpdateSchema,
  samlSettingsUpdateSchema,
  smtpSettingsSchema,
  ssoSettingsUpdateSchema,
  storageSettingsSchema,
} from "@/lib/validation/api";

const projectId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";

function requestWithBody(body: string): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("mutation input schemas", () => {
  it("rejects unknown fields in task movement input", () => {
    const result = moveTaskSchema.safeParse({ position: 2, unexpected: true });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer or negative reorder positions", () => {
    expect(moveTaskSchema.safeParse({ position: -1 }).success).toBe(false);
    expect(moveTaskSchema.safeParse({ position: 1.5 }).success).toBe(false);
  });

  it("accepts the append sentinel used by the WBS editor", () => {
    expect(moveTaskSchema.safeParse({
      newParentId: projectId,
      position: Number.MAX_SAFE_INTEGER,
    }).success).toBe(true);
  });

  it("requires a UUID project and at least two UUID task IDs for reorder", () => {
    expect(reorderTasksSchema.safeParse({ projectId: "bad", taskIds: [taskId, taskId] }).success).toBe(false);
    expect(reorderTasksSchema.safeParse({ projectId, taskIds: [taskId] }).success).toBe(false);
  });

  it("validates dependency type and bounded lag", () => {
    expect(dependencyCreateSchema.safeParse({ dependsOnId: taskId, type: "INVALID" }).success).toBe(false);
    expect(dependencyCreateSchema.safeParse({ dependsOnId: taskId, lag: 1.5 }).success).toBe(false);
    expect(dependencyCreateSchema.safeParse({ dependsOnId: taskId, lag: 2, lagUnit: "DAY" }).success).toBe(true);
  });

  it("accepts only the supported project creation fields", () => {
    expect(projectCreateSchema.safeParse({ name: "Project", unknown: true }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: "Project", departmentId: projectId }).success).toBe(true);
  });

  it("validates project update enums and rejects empty updates", () => {
    expect(projectUpdateSchema.safeParse({ status: "invalid" }).success).toBe(false);
    expect(projectUpdateSchema.safeParse({}).success).toBe(false);
    expect(projectUpdateSchema.safeParse({ visibility: "org" }).success).toBe(true);
  });

  it("validates department and subtask mutation shapes", () => {
    expect(departmentCreateSchema.safeParse({ name: "Engineering", parentId: projectId }).success).toBe(true);
    expect(departmentUpdateSchema.safeParse({}).success).toBe(false);
    expect(subtaskCreateSchema.safeParse({ title: "Child task" }).success).toBe(true);
    expect(subtaskUpdateSchema.safeParse({ status: "invalid" }).success).toBe(false);
  });

  it("validates tag and user enum fields", () => {
    expect(tagCreateSchema.safeParse({ name: "bug", projectId }).success).toBe(true);
    expect(tagUpdateSchema.safeParse({}).success).toBe(false);
    expect(userCreateSchema.safeParse({ email: "user@example.com", displayName: "User", role: "invalid" }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ theme: "dark", density: "compact", locale: "en_US" }).success).toBe(true);
    expect(userRoleUpdateSchema.safeParse({ role: "admin" }).success).toBe(true);
    expect(userRoleUpdateSchema.safeParse({ role: "root" }).success).toBe(false);
  });

  it("validates comment, membership, and webhook updates", () => {
    expect(commentUpdateSchema.safeParse({ bodyMarkdown: "Updated" }).success).toBe(true);
    expect(projectMemberCreateSchema.safeParse({ userId: taskId, projectRole: "viewer" }).success).toBe(true);
    expect(projectMemberUpdateSchema.safeParse({ projectRole: "owner" }).success).toBe(false);
    expect(publicWebhookUpdateSchema.safeParse({}).success).toBe(false);
    expect(attachmentUpdateSchema.safeParse({ name: "renamed.txt" }).success).toBe(true);
    expect(attachmentUpdateSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates administrative configuration updates", () => {
    expect(ldapSettingsUpdateSchema.safeParse({ enabled: true, url: "ldaps://ldap.example.com" }).success).toBe(true);
    expect(samlSettingsUpdateSchema.safeParse({ enabled: true, idpSsoUrl: "https://idp.example.com/sso" }).success).toBe(true);
    expect(ssoSettingsUpdateSchema.safeParse({ ldap: { enabled: true } }).success).toBe(true);
    expect(ssoSettingsUpdateSchema.safeParse({ unknown: {} }).success).toBe(false);
    expect(smtpSettingsSchema.safeParse({ smtp_host: "smtp.example.com", smtp_port: "587" }).success).toBe(true);
    expect(storageSettingsSchema.safeParse({ endpoint: "https://minio.example.com", useSSL: true }).success).toBe(true);
  });
});

describe("readJsonBody", () => {
  it("returns undefined for malformed JSON instead of throwing", async () => {
    await expect(readJsonBody(requestWithBody("{"))).resolves.toBeUndefined();
  });
});
