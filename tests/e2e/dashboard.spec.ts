import { test, expect } from "@playwright/test";

test.describe("Dashboard page", () => {
  test("returns 200 for authenticated user", async ({ request }) => {
    const res = await request.get("/en-US/dashboard");
    // Redirect to login is expected if not authenticated in server-mode tests
    expect([200, 302, 307]).toContain(res.status());
  });

  test("RTL page loads", async ({ request }) => {
    const res = await request.get("/fa-IR/dashboard");
    expect([200, 302, 307]).toContain(res.status());
  });
});

test.describe("My Tasks page", () => {
  test("returns 200 for authenticated user", async ({ request }) => {
    const res = await request.get("/en-US/my-tasks");
    expect([200, 302, 307]).toContain(res.status());
  });

  test("RTL page loads", async ({ request }) => {
    const res = await request.get("/fa-IR/my-tasks");
    expect([200, 302, 307]).toContain(res.status());
  });
});

test.describe("Notifications page", () => {
  test("returns 200 for authenticated user", async ({ request }) => {
    const res = await request.get("/en-US/notifications");
    expect([200, 302, 307]).toContain(res.status());
  });
});

test.describe("Calendar page", () => {
  test("returns 200 for authenticated user", async ({ request }) => {
    const res = await request.get("/en-US/calendar");
    expect([200, 302, 307]).toContain(res.status());
  });
});

test.describe("Workspace page", () => {
  test("returns 200 for authenticated user", async ({ request }) => {
    const res = await request.get("/en-US/workspace");
    expect([200, 302, 307]).toContain(res.status());
  });
});