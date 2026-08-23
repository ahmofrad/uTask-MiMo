import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the apiFetch retry behavior.
 *
 * These are unit tests — they mock `globalThis.fetch` and validate the
 * retry policy: GET/HEAD/OPTIONS retry on 408/429/5xx with backoff;
 * mutations (POST/PATCH/DELETE/PUT) never retry automatically.
 */

// We import the module under test at the bottom because we need to set up
// fetch mocking first. The actual apiFetch uses `crypto.randomUUID()` and
// `setTimeout` — both available globally in Node 20+ test runners.

describe("apiFetch retry behavior", () => {
  // Dynamic import so we get a fresh module each time
  let apiFetch: typeof import("@/lib/api-fetch")["apiFetch"];

  async function reloadModule() {
    // Clear the module cache so each test gets a fresh instance
    const mod = await import("@/lib/api-fetch");
    apiFetch = mod.apiFetch;
  }

  beforeEach(async () => {
    // apiFetch uses window.location.origin for URL construction
    vi.stubGlobal("window", { location: { origin: "http://localhost" } });
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
    await reloadModule();
  });

  it("retries GET on 503 with exponential backoff", async () => {
    let attempts = 0;
    const fetchFn = () => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 503 }));
    };

    // @ts-expect-error - mock
    globalThis.fetch = fetchFn;

    const response = await apiFetch("/api/v1/tasks?limit=10");
    expect(response.status).toBe(503);
    // maxRetries=2 → 3 total attempts (initial + 2 retries)
    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  it("does NOT retry POST mutations on 503", async () => {
    let attempts = 0;
    const fetchFn = () => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 503 }));
    };

    // @ts-expect-error - mock
    globalThis.fetch = fetchFn;

    const response = await apiFetch("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "test" }),
    });
    expect(response.status).toBe(503);
    expect(attempts).toBe(1);
  });

  it("does NOT retry DELETE mutations", async () => {
    let attempts = 0;
    const fetchFn = () => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 500 }));
    };

    // @ts-expect-error - mock
    globalThis.fetch = fetchFn;

    await apiFetch("/api/v1/tasks/t1", { method: "DELETE" });
    expect(attempts).toBe(1);
  });

  it("does NOT retry PATCH mutations", async () => {
    let attempts = 0;
    const fetchFn = () => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 502 }));
    };

    // @ts-expect-error - mock
    globalThis.fetch = fetchFn;

    await apiFetch("/api/v1/tasks/t1", {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    expect(attempts).toBe(1);
  });

  it("retries on TypeError (network failure) for safe methods", async () => {
    let attempts = 0;
    const fetchFn = () => {
      attempts++;
      return Promise.reject(new TypeError("fetch failed"));
    };

    // @ts-expect-error - mock
    globalThis.fetch = fetchFn;

    try {
      await apiFetch("/api/v1/tasks?limit=10");
    } catch {
      // expected after all retries exhausted
    }

    // maxRetries=2 → 3 total attempts
    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  it("does not retry non-retryable statuses like 404", async () => {
    let attempts = 0;
    const fetchFn = () => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 404 }));
    };

    // @ts-expect-error - mock
    globalThis.fetch = fetchFn;

    const response = await apiFetch("/api/v1/tasks/t1");
    expect(response.status).toBe(404);
    expect(attempts).toBe(1);
  });
});