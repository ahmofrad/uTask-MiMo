import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { decode } from "next-auth/jwt";
import { logger } from "@/lib/logging";
import { getSession } from "@/lib/auth/session-store";
import { prisma } from "@/lib/db";
import { canReadProject, canReadTask } from "@/lib/rbac";
import { randomUUID } from "@/lib/crypto";
import { waitForRedisReady } from "@/lib/queue/connection";

const GLOBAL_KEY = "__taskapp_socketio__";

function getGlobalIO(): Server | null {
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as Server | null;
}

function setGlobalIO(io: Server) {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = io;
}

let io: Server | null = null;
const userIds = new WeakMap<import("socket.io").Socket, string>();
type RoomJoinAck = (_joined: boolean) => void;

export function getIO(): Server | null {
  return getGlobalIO() ?? io;
}

export function getUserId(socket: import("socket.io").Socket): string | undefined {
  return userIds.get(socket);
}

async function verifyJwt(token: string): Promise<{ sub?: string; sessionId?: string } | null> {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return null;
    // Cookie name determines the derive-key salt: under HTTPS/AUTH_URL the cookie
    // is `__Secure-authjs.session-token`, otherwise `authjs.session-token`.
    const salts = ["authjs.session-token", "__Secure-authjs.session-token"] as const;
    for (const salt of salts) {
      try {
        const payload = await decode({ token, secret, salt });
        if (payload) return payload as { sub?: string; sessionId?: string };
      } catch {
        // Wrong-salt decryption throws — try the other cookie name.
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader: string | undefined, names: readonly string[]): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name && names.includes(name)) return valueParts.join("=");
  }
  return undefined;
}

export async function initSocketIO(httpServer: HTTPServer) {
  if (io) return io;

  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!origin && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_URL or NEXTAUTH_URL is required for Socket.IO CORS in production");
  }

  const opts: Record<string, unknown> = {
    path: "/ws",
    cors: { origin, credentials: true },
  };

  io = new Server(httpServer, opts as never);
  setGlobalIO(io);

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const pubClient = new Redis(redisUrl);
    await waitForRedisReady(pubClient as never);
    const subClient = pubClient.duplicate();
    await waitForRedisReady(subClient as never);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter connected");
  } catch (err) {
    if (process.env.NODE_ENV === "production") throw err;
    logger.warn("Redis unavailable — Socket.IO running without adapter (no multi-instance)");
  }

  io.use(async (socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : getCookieValue(socket.handshake.headers.cookie, [
              "authjs.session-token",
              "__Secure-authjs.session-token",
            ]);
      if (!token || typeof token !== "string") {
        return next(new Error("Authentication required"));
      }
      const payload = await verifyJwt(token);
      if (!payload?.sub || !payload.sessionId) {
        return next(new Error("Invalid or expired token"));
      }
      const session = await getSession(payload.sessionId);
      if (!session || session.userId !== payload.sub) {
        return next(new Error("Session revoked"));
      }
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true } });
      if (!user || user.status !== "active") {
        return next(new Error("User is inactive"));
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

    socket.on("join:project", async (projectId: string, ack?: RoomJoinAck) => {
      if (typeof projectId !== "string" || !(await canReadProject(userId, projectId))) {
        ack?.(false);
        return;
      }
      socket.join(`project:${projectId}`);
      ack?.(true);
    });

    socket.on("leave:project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("join:task", async (taskId: string, ack?: RoomJoinAck) => {
      if (typeof taskId !== "string" || !(await canReadTask(userId, taskId))) {
        ack?.(false);
        return;
      }
      socket.join(`task:${taskId}`);
      ack?.(true);
    });

    socket.on("leave:task", (taskId: string) => {
      socket.leave(`task:${taskId}`);
    });

    socket.on("presence:task", (taskId: string) => {
      void canReadTask(userId, taskId).then((allowed) => {
        if (!allowed) return;
        socket.to(`task:${taskId}`).emit("presence:update", {
          userId,
          taskId,
          online: true,
          requestId: randomUUID(),
        });
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
  getIO()?.to(`user:${userId}`).emit(event, withRequestId(data));
}

export function emitToProject(projectId: string, event: string, data: unknown) {
  getIO()?.to(`project:${projectId}`).emit(event, withRequestId(data));
}

export function emitToTask(taskId: string, event: string, data: unknown) {
  getIO()?.to(`task:${taskId}`).emit(event, withRequestId(data));
}

function withRequestId(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    return { ...record, requestId: typeof record.requestId === "string" ? record.requestId : randomUUID() };
  }
  return { data, requestId: randomUUID() };
}
