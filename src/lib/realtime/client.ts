import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";

let socket: ReturnType<typeof io> | null = null;

export function getSocket(token?: string) {
  if (!socket) {
    const options = {
      path: "/ws",
      withCredentials: true,
      autoConnect: false,
      transports: ["websocket", "polling"],
      ...(token ? { auth: { token } } : {}),
    };
    socket = io(SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : ""), options);
  } else if (token) {
    socket.auth = { token };
  }
  return socket;
}

function connectedSocket() {
  const client = getSocket();
  if (!client.connected) client.connect();
  return client;
}

export function joinProject(projectId: string) {
  connectedSocket().emit("join:project", projectId);
}

export function leaveProject(projectId: string) {
  connectedSocket().emit("leave:project", projectId);
}

export function joinTask(taskId: string) {
  connectedSocket().emit("join:task", taskId);
}

export function leaveTask(taskId: string) {
  connectedSocket().emit("leave:task", taskId);
}

export function sendPresence(taskId: string) {
  connectedSocket().emit("presence:task", taskId);
}
