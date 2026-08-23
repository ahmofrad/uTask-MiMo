import { test, expect } from "@playwright/test";

test.describe("Search", () => {
  test("search API returns empty results for gibberish query", async ({ request }) => {
    const csrfRes = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const cookies = await request.storageState().then((s) => s.cookies);
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const loginRes = await request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: "admin@utask.local", password: "password" },
    });
    expect(loginRes.status()).toBe(200);

    const res = await request.get("/api/v1/search?q=zzzznotarealthingatall", {
      headers: { "x-csrf-token": csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.tasks ?? []).toHaveLength(0);
  });

  test("search API returns results for a known seed task", async ({ request }) => {
    const csrfRes = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const cookies = await request.storageState().then((s) => s.cookies);
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const loginRes = await request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: "admin@utask.local", password: "password" },
    });
    expect(loginRes.status()).toBe(200);

    const res = await request.get("/api/v1/search?q=launch&type=all", {
      headers: { "x-csrf-token": csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.tasks)).toBe(true);
    expect(body.data.tasks.length).toBeGreaterThan(0);
    // At minimum the "launch checklist" task should appear.
    const titles = body.data.tasks.map((i: Record<string, unknown>) => i.title).filter(Boolean);
    expect(titles.some((t: string) => t.toLowerCase().includes("launch"))).toBe(true);
  });

  test("search API requires auth", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const res = await context.request.get("/api/v1/search?q=test");
      expect(res.status()).toBe(401);
    } finally {
      await context.close();
    }
  });

  test("search API requires minimum 2 characters", async ({ request }) => {
    const csrfRes = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const cookies = await request.storageState().then((s) => s.cookies);
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const loginRes = await request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: "admin@utask.local", password: "password" },
    });
    expect(loginRes.status()).toBe(200);

    const res = await request.get("/api/v1/search?q=a", {
      headers: { "x-csrf-token": csrf },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("search API filters by type=project", async ({ request }) => {
    const csrfRes = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const cookies = await request.storageState().then((s) => s.cookies);
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const loginRes = await request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: "admin@utask.local", password: "password" },
    });
    expect(loginRes.status()).toBe(200);

    const res = await request.get("/api/v1/search?q=product&type=project", {
      headers: { "x-csrf-token": csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.projects)).toBe(true);
    // Project results are grouped under `projects` by the API response.
    for (const item of body.data.projects) {
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
    }
  });
});