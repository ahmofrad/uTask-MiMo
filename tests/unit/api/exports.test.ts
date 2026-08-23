import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/projects/queries", () => ({ getUserReadableProjectIds: vi.fn() }));

import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { GET } from "@/app/api/v1/exports/route";

it("requires the data:export permission", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ userId: "user-1", organizationId: "org-1", organizationRole: "member" } as never);
  vi.mocked(can).mockResolvedValue(false);
  const response = await GET(new Request("http://localhost/api/v1/exports?resource=tasks"));
  expect(response.status).toBe(403);
  expect((await response.json()).code).toBe("FORBIDDEN");
});
