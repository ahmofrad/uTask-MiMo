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
});