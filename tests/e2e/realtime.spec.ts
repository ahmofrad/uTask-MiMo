import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { io as ioc } from "socket.io-client";
import type { Socket } from "socket.io-client";

const BASE_URL = "http://localhost:3000";
const ADMIN_EMAIL = "admin@utask.local";
const ADMIN_PASSWORD = "password123";
const MEMBER_EMAIL = "member@utask.local";
const MEMBER_PASSWORD = "password123";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
}

async function getJwtToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "authjs.session-token")?.value;
  if (!token) throw new Error("No session token found");
  return token;
}

async function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(BASE_URL, {
      path: "/ws",
      auth: { token },
      transports: ["websocket"],
    });
    const timeout = setTimeout(() => reject(new Error("Socket connection timeout")), 5000);
    socket.on("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

test.describe("Realtime cross-user events", () => {
  test("member receives task.created event within 1s when admin creates a task", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const memberPage = await memberCtx.newPage();

    // Admin: login and create project
    await adminPage.goto("/login");
    await adminPage.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await adminPage.getByRole("textbox", { name: /password/i }).fill(ADMIN_PASSWORD);
    await adminPage.getByRole("button", { name: /sign in/i }).click();
    await adminPage.waitForURL(/\/(en-US|fa-IR)?\/?$/);

    const adminToken = await getJwtToken(adminPage);

    const adminCookies = await adminPage.context().cookies();
    const adminCsrf = adminCookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const projectRes = await adminPage.request.post("/api/v1/projects", {
      headers: { "content-type": "application/json", "x-csrf-token": adminCsrf },
      data: { name: `Realtime E2E ${Date.now()}` },
    });
    expect(projectRes.status()).toBe(201);
    const projectData = await projectRes.json();
    const projectId = projectData.data.id as string;

    // Add member to project
    const usersRes = await adminPage.request.get("/api/v1/users");
    const usersBody = await usersRes.json();
    const usersList: Array<{ id: string; email: string }> = usersBody.data ?? usersBody;
    const memberUser = usersList.find((u) => u.email === MEMBER_EMAIL);
    expect(memberUser).toBeTruthy();

    const addMemberRes = await adminPage.request.post(`/api/v1/projects/${projectId}/members`, {
      headers: { "content-type": "application/json", "x-csrf-token": adminCsrf },
      data: { userId: memberUser!.id, projectRole: "contributor" },
    });
    expect(addMemberRes.status()).toBe(201);

    // Member: login
    await memberPage.goto("/login");
    await memberPage.getByLabel(/email/i).fill(MEMBER_EMAIL);
    await memberPage.getByRole("textbox", { name: /password/i }).fill(MEMBER_PASSWORD);
    await memberPage.getByRole("button", { name: /sign in/i }).click();
    await memberPage.waitForURL(/\/(en-US|fa-IR)?\/?$/);

    const memberToken = await getJwtToken(memberPage);

    // Both connect to Socket.IO and join project room
    const adminSocket = await connectSocket(adminToken);
    const memberSocket = await connectSocket(memberToken);

    adminSocket.emit("join:project", projectId);
    memberSocket.emit("join:project", projectId);

    // Member waits for task.created event
    const memberReceived = new Promise<void>((resolve) => {
      memberSocket.on("task.created", () => resolve());
    });

    // Admin creates a task
    const taskRes = await adminPage.request.post("/api/v1/tasks", {
      headers: { "content-type": "application/json", "x-csrf-token": adminCsrf },
      data: { projectId, title: "Realtime Cross-User Task" },
    });
    expect(taskRes.status()).toBe(201);

    // Member should receive the event within 1 second
    await expect(memberReceived).resolves.toBeUndefined();

    adminSocket.close();
    memberSocket.close();
    await adminCtx.close();
    await memberCtx.close();
  });
});
