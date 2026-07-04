import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";

let socket: ReturnType<typeof io> | null = null;

export function getSocket(token?: string) {
  if (!socket) {
    socket = io(SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : ""), {
      path: "/ws",
      auth: { token },
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function joinProject(projectId: string) {
  getSocket()?.emit("join:project", projectId);
}

export function leaveProject(projectId: string) {
  getSocket()?.emit("leave:project", projectId);
}

export function joinTask(taskId: string) {
  getSocket()?.emit("join:task", taskId);
}

export function leaveTask(taskId: string) {
  getSocket()?.emit("leave:task", taskId);
}

export function sendPresence(taskId: string) {
  getSocket()?.emit("presence:task", taskId);
}
