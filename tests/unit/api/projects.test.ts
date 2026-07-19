import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => ({ hit: false })),
  setIdempotencyResult: vi.fn(),
}));
vi.mock("@/lib/projects", () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  getProjectById: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/projects", init);
}

const { auth } = await import("@/lib/auth/config");
const { listProjects, createProject, getProjectById, archiveProject } = await import("@/lib/projects");
const { logAudit } = await import("@/lib/audit/log");
const { emitTaskEvent } = await import("@/lib/webhook/emit");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockListProjects = listProjects as ReturnType<typeof vi.fn>;
const mockCreateProject = createProject as ReturnType<typeof vi.fn>;
const mockGetProjectById = getProjectById as ReturnType<typeof vi.fn>;
const mockArchiveProject = archiveProject as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockEmitTaskEvent = emitTaskEvent as ReturnType<typeof vi.fn>;

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

describe("POST /api/v1/projects", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/projects/route");
    const res = await POST(makeRequest("POST", { name: "Proj" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/projects/route");
    const res = await POST(makeRequest("POST", { name: "Proj" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/projects/route");
    const res = await POST(makeRequest("POST", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates project, logs audit, emits event", async () => {
    mockCan.mockResolvedValue(true);
    mockCreateProject.mockResolvedValue({ id: "p1", name: "Proj" });

    const { POST } = await import("@/app/api/v1/projects/route");
    const res = await POST(makeRequest("POST", { name: "Proj" }));

    expect(res.status).toBe(201);
    expect(mockCreateProject).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_created" }),
    );
    expect(mockEmitTaskEvent).toHaveBeenCalledWith("project.created", "p1", expect.anything(), "user-1");
  });
});

describe("GET /api/v1/projects", () => {
  it("returns project list", async () => {
    mockListProjects.mockResolvedValue({ data: [], nextCursor: null });
    const { GET } = await import("@/app/api/v1/projects/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("DELETE /api/v1/projects/[projectId]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { DELETE } = await import("@/app/api/v1/projects/[projectId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { projectId: "p1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { DELETE } = await import("@/app/api/v1/projects/[projectId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { projectId: "p1" } });
    expect(res.status).toBe(403);
  });

  it("archives project and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockGetProjectById.mockResolvedValue({ projectId: "p1", name: "Proj" });
    mockArchiveProject.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/v1/projects/[projectId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { projectId: "p1" } });

    expect(res.status).toBe(200);
    expect(mockArchiveProject).toHaveBeenCalledWith("p1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_archived" }),
    );
  });
});
