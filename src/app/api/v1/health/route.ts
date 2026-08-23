import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const isReadinessProbe = searchParams.get("ready") === "1";
  const isWorkerProbe = searchParams.get("worker") === "1";
  if (isReadinessProbe || isWorkerProbe) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redis = await getRedis();
      await redis.ping();
      if (isWorkerProbe && !existsSync(process.env.WORKER_READY_FILE ?? "/tmp/taskapp-worker-ready")) {
        return NextResponse.json({ status: "worker_not_ready" }, { status: 503 });
      }
    } catch {
      return NextResponse.json({ status: "not_ready" }, { status: 503 });
    }
  }

  return NextResponse.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    ...(isWorkerProbe ? { workerReady: existsSync(process.env.WORKER_READY_FILE ?? "/tmp/taskapp-worker-ready") } : {}),
  });
}
