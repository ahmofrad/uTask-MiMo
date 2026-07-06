import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTx = {
  project: {
    create: vi.fn(),
    update: vi.fn(),
  },
  projectMember: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    project: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { createProject, archiveProject } from "@/lib/projects/mutations";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProject", () => {
  it("creates project and adds creator as lead member", async () => {
    const mockProject = { id: "proj-1", name: "Test Project" };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      mockTx.project.create.mockResolvedValue(mockProject);
      mockTx.projectMember.create.mockResolvedValue({} as never);
      return fn(mockTx);
    });

    const result = await createProject({
      name: "Test Project",
      ownerId: "user-1",
    });

    expect(result.id).toBe("proj-1");
    expect(mockTx.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "proj-1",
        userId: "user-1",
        projectRole: "lead",
        addedBy: "user-1",
      },
    });
  });

  it("uses default color and visibility", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      mockTx.project.create.mockResolvedValue({ id: "proj-1" });
      mockTx.projectMember.create.mockResolvedValue({} as never);
      return fn(mockTx);
    });

    await createProject({ name: "Test", ownerId: "user-1" });

    expect(mockTx.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          color: "#2563eb",
          visibility: "private",
        }),
      }),
    );
  });
});

describe("archiveProject", () => {
  it("sets archivedAt timestamp", async () => {
    vi.mocked(prisma.project.update).mockResolvedValue({} as never);

    await archiveProject("proj-1");

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "proj-1" },
      data: { archivedAt: expect.any(Date) },
    });
  });
});
