import { describe, expect, it } from "vitest";
import { problemResponse } from "@/lib/api/problem";

describe("problemResponse", () => {
  it("returns RFC 7807 fields and preserves the legacy error shape", async () => {
    const request = new Request("http://localhost/api/v1/projects", {
      headers: { "x-request-id": "req-123" },
    });
    const response = problemResponse(request, 403, "FORBIDDEN", "Insufficient permissions");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(response.headers.get("x-request-id")).toBe("req-123");
    expect(body).toMatchObject({
      type: "https://taskapp.local/problems/forbidden",
      title: "Forbidden",
      status: 403,
      detail: "Insufficient permissions",
      instance: "/api/v1/projects",
      requestId: "req-123",
      code: "FORBIDDEN",
      error: { code: "FORBIDDEN", message: "Insufficient permissions" },
    });
  });

  it("creates a request ID when the middleware did not provide one", async () => {
    const request = new Request("http://localhost/api/v1/tasks");
    const response = problemResponse(request, 400, "VALIDATION_ERROR", "Request validation failed", {
      field: "title",
    });
    const body = await response.json();

    expect(body.requestId).toEqual(expect.any(String));
    expect(body.field).toBe("title");
    expect(body.error.field).toBe("title");
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
  });
});
