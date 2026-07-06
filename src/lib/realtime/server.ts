import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { logger } from "@/lib/logging";

let io: Server | null = null;
const userIds = new WeakMap<import("socket.io").Socket, string>();

export function getIO(): Server | null {
  return io;
}

export function getUserId(socket: import("socket.io").Socket): string | undefined {
  return userIds.get(socket);
}

function verifyJwt(token: string): { sub?: string } | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
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

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter connected");
  } catch {
    logger.warn("Redis unavailable — Socket.IO running without adapter (no multi-instance)");
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("Authentication required"));
      }
      const payload = verifyJwt(token);
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
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToProject(projectId: string, event: string, data: unknown) {
  io?.to(`project:${projectId}`).emit(event, data);
}

export function emitToTask(taskId: string, event: string, data: unknown) {
  io?.to(`task:${taskId}`).emit(event, data);
}
