import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/departments", () => ({
  listDepartments: vi.fn(),
  createDepartment: vi.fn(),
  getDepartmentById: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/departments", init);
}

const { auth } = await import("@/lib/auth/config");
const { can } = await import("@/lib/rbac");
const { listDepartments, createDepartment, getDepartmentById, updateDepartment, deleteDepartment } =
  await import("@/lib/departments");
const { logAudit } = await import("@/lib/audit/log");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
const mockListDepartments = listDepartments as ReturnType<typeof vi.fn>;
const mockCreateDepartment = createDepartment as ReturnType<typeof vi.fn>;
const mockGetDepartmentById = getDepartmentById as ReturnType<typeof vi.fn>;
const mockUpdateDepartment = updateDepartment as ReturnType<typeof vi.fn>;
const mockDeleteDepartment = deleteDepartment as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("GET /api/v1/departments", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/departments/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { GET } = await import("@/app/api/v1/departments/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns department list", async () => {
    mockCan.mockResolvedValue(true);
    mockListDepartments.mockResolvedValue([{ id: "d1", name: "Engineering" }]);

    const { GET } = await import("@/app/api/v1/departments/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("d1");
  });
});

describe("POST /api/v1/departments", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/departments/route");
    const res = await POST(makeRequest("POST", { name: "Sales" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/departments/route");
    const res = await POST(makeRequest("POST", { name: "Sales" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/departments/route");
    const res = await POST(makeRequest("POST", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates department and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockCreateDepartment.mockResolvedValue({ id: "d1", name: "Sales" });

    const { POST } = await import("@/app/api/v1/departments/route");
    const res = await POST(makeRequest("POST", { name: "Sales" }));

    expect(res.status).toBe(201);
    expect(mockCreateDepartment).toHaveBeenCalledWith({ name: "Sales" });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "department_created", entityType: "department" }),
    );
  });
});

describe("GET /api/v1/departments/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/departments/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "d1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { GET } = await import("@/app/api/v1/departments/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "d1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when department not found", async () => {
    mockCan.mockResolvedValue(true);
    mockGetDepartmentById.mockResolvedValue(null);
    const { GET } = await import("@/app/api/v1/departments/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "d1" } });
    expect(res.status).toBe(404);
  });

  it("returns department by id", async () => {
    mockCan.mockResolvedValue(true);
    mockGetDepartmentById.mockResolvedValue({ id: "d1", name: "Engineering" });
    const { GET } = await import("@/app/api/v1/departments/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "d1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("d1");
  });
});

describe("PATCH /api/v1/departments/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { PATCH } = await import("@/app/api/v1/departments/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { name: "Updated" }), { params: { id: "d1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { PATCH } = await import("@/app/api/v1/departments/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { name: "Updated" }), { params: { id: "d1" } });
    expect(res.status).toBe(403);
  });

  it("updates department and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockGetDepartmentById.mockResolvedValue({ id: "d1", name: "Old" });
    mockUpdateDepartment.mockResolvedValue({ id: "d1", name: "Updated" });

    const { PATCH } = await import("@/app/api/v1/departments/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { name: "Updated" }), { params: { id: "d1" } });

    expect(res.status).toBe(200);
    expect(mockUpdateDepartment).toHaveBeenCalledWith("d1", { name: "Updated" });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "department_updated", entityType: "department" }),
    );
  });
});

describe("DELETE /api/v1/departments/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { DELETE } = await import("@/app/api/v1/departments/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "d1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { DELETE } = await import("@/app/api/v1/departments/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "d1" } });
    expect(res.status).toBe(403);
  });

  it("deletes department and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockGetDepartmentById.mockResolvedValue({ id: "d1", name: "Engineering" });
    mockDeleteDepartment.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/v1/departments/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "d1" } });

    expect(res.status).toBe(200);
    expect(mockDeleteDepartment).toHaveBeenCalledWith("d1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "department_deleted", entityType: "department" }),
    );
  });
});
