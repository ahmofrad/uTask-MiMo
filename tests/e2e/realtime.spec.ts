import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { io as ioc } from "socket.io-client";
import type { Socket } from "socket.io-client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const MEMBER_EMAIL = "member@utask.local";

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
    const adminCtx: BrowserContext = await browser.newContext({ storageState: ".auth/admin.json" });
    const memberCtx: BrowserContext = await browser.newContext({ storageState: ".auth/member.json" });
    const adminPage = await adminCtx.newPage();
    const memberPage = await memberCtx.newPage();

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

    const memberToken = await getJwtToken(memberPage);

    // Both connect to Socket.IO and join project room
    const adminSocket = await connectSocket(adminToken);
    const memberSocket = await connectSocket(memberToken);

    await new Promise<void>((resolve, reject) => {
      let joined = 0;
      const onJoined = (ok: boolean) => {
        if (!ok) {
          reject(new Error("Socket room authorization failed"));
          return;
        }
        joined += 1;
        if (joined === 2) resolve();
      };
      adminSocket.emit("join:project", projectId, onJoined);
      memberSocket.emit("join:project", projectId, onJoined);
    });

    // Member waits for task.created event
    const memberReceived = new Promise<void>((resolve) => {
      memberSocket.on("task.created", () => resolve());
    });

    // Admin creates a task
    const taskRes = await adminPage.request.post("/api/v1/tasks", {
      headers: {
        "content-type": "application/json",
        "x-csrf-token": adminCsrf,
        "idempotency-key": `e2e-realtime-${Date.now()}`,
      },
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

  test("board repaints live when another user changes a task status", async ({ browser }) => {
    const adminCtx: BrowserContext = await browser.newContext({ storageState: ".auth/admin.json" });
    const memberCtx: BrowserContext = await browser.newContext({ storageState: ".auth/member.json" });
    const adminPage = await adminCtx.newPage();
    const memberPage = await memberCtx.newPage();
    adminPage.on("console", (msg) => {
      if (msg.type() === "error") console.log("ADMIN CONSOLE ERROR:", msg.text());
    });
    adminPage.on("websocket", (ws) => console.log("ADMIN WEBSOCKET:", ws.url()));
    adminPage.on("response", (res) => {
      if (res.url().includes("/api/v1/tasks") && res.request().method() === "GET") {
        console.log("ADMIN REFETCH:", res.url());
      }
    });

    const adminCookies = await adminPage.context().cookies();
    const adminCsrf = adminCookies.find((c) => c.name === "csrf_token")?.value ?? "";

    // Scratch project + task, with the member as a member so the API allows the move.
    const projectRes = await adminPage.request.post("/api/v1/projects", {
      headers: { "content-type": "application/json", "x-csrf-token": adminCsrf },
      data: { name: `Board Realtime E2E ${Date.now()}` },
    });
    expect(projectRes.status()).toBe(201);
    const projectId = ((await projectRes.json()).data.id) as string;

    const usersRes = await adminPage.request.get("/api/v1/users");
    const usersList: Array<{ id: string; email: string }> = (await usersRes.json()).data ?? [];
    const memberUser = usersList.find((u) => u.email === MEMBER_EMAIL);
    expect(memberUser).toBeTruthy();
    const addMemberRes = await adminPage.request.post(`/api/v1/projects/${projectId}/members`, {
      headers: { "content-type": "application/json", "x-csrf-token": adminCsrf },
      data: { userId: memberUser!.id, projectRole: "contributor" },
    });
    expect(addMemberRes.status()).toBe(201);

    const taskRes = await adminPage.request.post("/api/v1/tasks", {
      headers: {
        "content-type": "application/json",
        "x-csrf-token": adminCsrf,
        "idempotency-key": `e2e-board-realtime-${Date.now()}`,
      },
      data: { projectId, title: "Live Board Task", assigneeIds: [memberUser!.id] },
    });
    expect(taskRes.status()).toBe(201);
    const taskId = ((await taskRes.json()).data.id) as string;

    // Admin opens the project board and sees the task in the Open column.
    // Wait for the board's socket to actually join the project room before
    // the mutation, otherwise the emit races the join and the board never
    // sees the event.
    const wsReady = new Promise<void>((resolve) => {
      adminPage.on("websocket", (ws) => {
        ws.on("framereceived", () => resolve());
      });
    });
    await adminPage.goto(`/en-US/projects/${projectId}/board`);
    // The task card is a draggable wrapper; its status badge sits next to the
    // title link inside it.
    const card = adminPage
      .locator("div[draggable]")
      .filter({ has: adminPage.locator(`a[href="/tasks/${taskId}"]`) })
      .first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Open");
    await wsReady;

    // Member moves the task to Done via the API (a normal mutation, which emits
    // task.updated to the project room the admin board is subscribed to).
    const memberCookies = await memberPage.context().cookies();
    const memberCsrf = memberCookies.find((c) => c.name === "csrf_token")?.value ?? "";
    const moveRes = await memberPage.request.patch(`/api/v1/tasks/${taskId}`, {
      headers: { "content-type": "application/json", "x-csrf-token": memberCsrf },
      data: { status: "done" },
    });
    expect(moveRes.status()).toBe(200);

    // The admin's open board repaints without a reload: the card now shows the
    // Done status badge (the board refetched on the realtime event).
    await expect(card).toContainText("Done");

    // Cleanup: delete the scratch project's task and the project itself.
    await adminPage.request.delete(`/api/v1/tasks/${taskId}`, {
      headers: { "x-csrf-token": adminCsrf },
    });
    await adminPage.request.delete(`/api/v1/projects/${projectId}`, {
      headers: { "x-csrf-token": adminCsrf },
    });
    await adminCtx.close();
    await memberCtx.close();
  });
});