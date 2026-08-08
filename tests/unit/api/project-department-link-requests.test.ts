import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuth,
  mockCanProject,
  mockCanReadProject,
  mockCanApprove,
  mockGetRecipients,
  mockNotify,
  mockProjectFindUnique,
  mockRequestFindMany,
  mockCreateRequest,
  mockReviewRequest,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockCanProject: vi.fn(),
  mockCanReadProject: vi.fn(),
  mockCanApprove: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockRequestFindMany: vi.fn(),
  mockCreateRequest: vi.fn(),
  mockReviewRequest: vi.fn(),
  mockLogAudit: vi.fn(),
  mockGetRecipients: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/rbac", () => ({ canProject: mockCanProject, canReadProject: mockCanReadProject }));
vi.mock("@/lib/departments/requests", () => ({
  canApproveDepartmentLinkRequest: mockCanApprove,
  getDepartmentLinkRequestRecipientIds: mockGetRecipients,
}));
vi.mock("@/lib/db", () => ({ prisma: {
  project: { findUnique: mockProjectFindUnique },
  projectDepartmentLinkRequest: { findMany: mockRequestFindMany },
} }));
vi.mock("@/lib/projects/department-links", () => ({
  createDepartmentLinkRequest: mockCreateRequest,
  reviewDepartmentLinkRequest: mockReviewRequest,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/notifications", () => ({ notify: mockNotify }));

import { GET, POST } from "@/app/api/v1/projects/[projectId]/department-link-requests/route";
import { PATCH } from "@/app/api/v1/projects/[projectId]/department-link-requests/[requestId]/route";

const projectId = "00000000-0000-4000-8000-000000000010";
const departmentId = "00000000-0000-4000-8000-000000000020";
const requestId = "00000000-0000-4000-8000-000000000030";

function request(method: string, body?: unknown) {
  return new Request(`http://localhost/api/v1/projects/${projectId}/department-link-requests`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "manager-1" });
  mockCanProject.mockResolvedValue(true);
  mockCanReadProject.mockResolvedValue(true);
  mockCanApprove.mockResolvedValue(false);
  mockProjectFindUnique.mockResolvedValue({ id: projectId });
  mockRequestFindMany.mockResolvedValue([]);
  mockCreateRequest.mockResolvedValue({
    id: requestId,
    status: "pending",
    departmentId,
    requestedById: "manager-1",
    projectId,
    project: { name: "Roadmap" },
    department: { name: "Engineering" },
  });
  mockGetRecipients.mockResolvedValue(["manager-2"]);
  mockReviewRequest.mockResolvedValue({ id: requestId, status: "approved" });
});

describe("POST project department-link-requests", () => {
  it("creates a pending request and audits it", async () => {
    const response = await POST(request("POST", { departmentId }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(201);
    expect(mockCreateRequest).toHaveBeenCalledWith({
      projectId,
      departmentId,
      requestedById: "manager-1",
    });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "project_department_link_requested",
      entityId: requestId,
    }));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      userId: "manager-2",
      type: "department_link_request",
      payload: expect.objectContaining({ projectName: "Roadmap", departmentName: "Engineering" }),
    }));
  });

  it("denies users who cannot manage the project", async () => {
    mockCanProject.mockResolvedValue(false);

    const response = await POST(request("POST", { departmentId }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(403);
    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  it("returns not found when the target department is archived or missing", async () => {
    mockCreateRequest.mockResolvedValue({ kind: "not_found" });

    const response = await POST(request("POST", { departmentId }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(404);
    expect(mockLogAudit).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("GET project department-link-requests", () => {
  it("lets a target department manager discover pending requests", async () => {
    mockCanReadProject.mockResolvedValue(false);
    mockRequestFindMany.mockResolvedValue([
      { id: requestId, departmentId, status: "pending" },
    ]);
    mockCanApprove.mockResolvedValue(true);

    const response = await GET(request("GET"), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(200);
    expect(mockRequestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId },
    }));
  });
});

describe("PATCH project department-link-requests/:requestId", () => {
  it("approves a request and audits the decision", async () => {
    const response = await PATCH(request("PATCH", { decision: "approved" }), {
      params: Promise.resolve({ projectId, requestId }),
    });

    expect(response.status).toBe(200);
    expect(mockReviewRequest).toHaveBeenCalledWith(requestId, "manager-1", "approved", projectId);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "project_department_link_approved",
      entityId: requestId,
    }));
  });

  it("returns forbidden when the service rejects an approval", async () => {
    mockReviewRequest.mockResolvedValue({ kind: "forbidden" });

    const response = await PATCH(request("PATCH", { decision: "approved" }), {
      params: Promise.resolve({ projectId, requestId }),
    });

    expect(response.status).toBe(403);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("allows the requester cancellation decision through the same endpoint", async () => {
    mockReviewRequest.mockResolvedValue({ id: requestId, status: "cancelled" });

    const response = await PATCH(request("PATCH", { decision: "cancelled" }), {
      params: Promise.resolve({ projectId, requestId }),
    });

    expect(response.status).toBe(200);
    expect(mockReviewRequest).toHaveBeenCalledWith(requestId, "manager-1", "cancelled", projectId);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "project_department_link_cancelled",
    }));
  });
});
