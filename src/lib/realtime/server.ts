import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { decode } from "next-auth/jwt";
import { logger } from "@/lib/logging";

const GLOBAL_KEY = "__taskapp_socketio__";

function getGlobalIO(): Server | null {
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as Server | null;
}

function setGlobalIO(io: Server) {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = io;
}

let io: Server | null = null;
const userIds = new WeakMap<import("socket.io").Socket, string>();

export function getIO(): Server | null {
  return getGlobalIO() ?? io;
}

export function getUserId(socket: import("socket.io").Socket): string | undefined {
  return userIds.get(socket);
}

async function verifyJwt(token: string): Promise<{ sub?: string } | null> {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return null;
    const payload = await decode({
      token,
      secret,
      salt: "authjs.session-token",
    });
    return payload;
  } catch {
    return null;
  }
}

export async function initSocketIO(httpServer: HTTPServer) {
  if (io) return io;

  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  const opts: Record<string, unknown> = {
    path: "/ws",
    cors: { origin, credentials: true },
  };

  io = new Server(httpServer, opts as never);
  setGlobalIO(io);

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter connected");
  } catch {
    logger.warn("Redis unavailable — Socket.IO running without adapter (no multi-instance)");
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("Authentication required"));
      }
      const payload = await verifyJwt(token);
      if (!payload?.sub) {
        return next(new Error("Invalid or expired token"));
      }
      userIds.set(socket, payload.sub);
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = userIds.get(socket);
    if (!userId) {
      socket.disconnect();
      return;
    }

    logger.debug({ userId }, "Socket.IO client connected");

    socket.join(`user:${userId}`);

    socket.on("join:project", (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on("leave:project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("join:task", (taskId: string) => {
      socket.join(`task:${taskId}`);
    });

    socket.on("leave:task", (taskId: string) => {
      socket.leave(`task:${taskId}`);
    });

    socket.on("presence:task", (taskId: string) => {
      socket.to(`task:${taskId}`).emit("presence:update", {
        userId,
        taskId,
        online: true,
      });
    });

    socket.on("disconnect", () => {
      userIds.delete(socket);
      logger.debug({ userId }, "Socket.IO client disconnected");
    });
  });

  logger.info("Socket.IO server initialized");
  return io;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  getIO()?.to(`user:${userId}`).emit(event, data);
}

export function emitToProject(projectId: string, event: string, data: unknown) {
  getIO()?.to(`project:${projectId}`).emit(event, data);
}

export function emitToTask(taskId: string, event: string, data: unknown) {
  getIO()?.to(`task:${taskId}`).emit(event, data);
}
