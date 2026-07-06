import { test, expect } from "@playwright/test";

test.describe("Tags", () => {
  test("can create and list tags via API", async ({ request }) => {
    // Login first to get session
    const loginRes = await request.post("/api/auth/callback/credentials", {
      form: { email: "admin@taskapp.local", password: "admin123" },
    });
    // Create tag
    const res = await request.post("/api/v1/tags", {
      data: { name: "test-tag", color: "#ff0000" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("test-tag");
    // List tags
    const listRes = await request.get("/api/v1/tags");
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.some((t: any) => t.name === "test-tag")).toBe(true);
  });
});
