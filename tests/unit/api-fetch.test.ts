import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-fetch";

describe("apiFetch", () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { origin: "http://localhost" } });
    fetchMock.mockClear();
  });

  it("leaves FormData content type unset so the browser adds its boundary", async () => {
    const form = new FormData();
    form.set("token", "reset-token");

    await apiFetch("/api/v1/auth/reset-password", { method: "POST", body: form });

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect((options as RequestInit).headers).toBeInstanceOf(Headers);
    expect(((options as RequestInit).headers as Headers).has("content-type")).toBe(false);
  });

  it("adds the CSRF token to state-changing requests", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=test-csrf-token" });

    await apiFetch("/api/v1/tasks/t1", {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });

    const [, options] = fetchMock.mock.calls[0] ?? [];
    const headers = (options as RequestInit).headers as Headers;
    expect(headers.get("x-csrf-token")).toBe("test-csrf-token");
  });

  it("adds idempotency keys to task creation requests", async () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "request-id") });

    await apiFetch("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "Task" }),
    });

    const [, options] = fetchMock.mock.calls[0] ?? [];
    const headers = (options as RequestInit).headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("request-id");
  });

  it("sets JSON content type for string request bodies", async () => {
    await apiFetch("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "admin@utask.local" }),
    });

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(((options as RequestInit).headers as Headers).get("content-type")).toBe("application/json");
  });
});
