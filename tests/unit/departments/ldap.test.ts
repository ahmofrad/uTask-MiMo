import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    department: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { ensureLdapDepartment } from "@/lib/departments";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureLdapDepartment", () => {
  it("creates an active LDAP-backed department for a selected group", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.department.create).mockResolvedValue({
      id: "department-1",
      name: "Engineering",
      source: "ldap",
      ldapSyncGroupId: "group-1",
      deletedAt: null,
    } as never);

    const result = await ensureLdapDepartment({ id: "group-1", name: "Engineering" });

    expect(result.created).toBe(true);
    expect(result.renamed).toBe(false);

    expect(prisma.department.create).toHaveBeenCalledWith({
      data: {
        name: "Engineering",
        source: "ldap",
        ldapSyncGroupId: "group-1",
        deletedAt: null,
      },
    });
  });

  it("renames and reactivates an existing LDAP-backed department", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: "department-1",
      name: "Old Engineering",
      source: "ldap",
      ldapSyncGroupId: "group-1",
      deletedAt: new Date(),
    } as never);
    vi.mocked(prisma.department.update).mockResolvedValue({} as never);

    const result = await ensureLdapDepartment({ id: "group-1", name: "Engineering" });

    expect(result.created).toBe(false);
    expect(result.renamed).toBe(true);

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "department-1" },
      data: { name: "Engineering", deletedAt: null },
    });
  });
});
