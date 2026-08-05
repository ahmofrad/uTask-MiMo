import { test, expect } from "@playwright/test";

test.describe("Tags", () => {
  test("can create and list tags via API", async ({ request }) => {
    // Login first to get session
    const csrfRes = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const cookies = await request.storageState().then((s) => s.cookies);
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const loginRes = await request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: "admin@utask.local", password: "password123" },
    });
    expect(loginRes.status()).toBe(200);
    // Create tag
    const tagName = `test-tag-${Date.now()}`;
    const res = await request.post("/api/v1/tags", {
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      data: { name: tagName, color: "#ff0000" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe(tagName);
    // List tags
    const listRes = await request.get("/api/v1/tags");
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.some((t: any) => t.name === tagName)).toBe(true);
  });
});
