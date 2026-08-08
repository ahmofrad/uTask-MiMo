import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export async function GET(request: Request) {
  const isReadinessProbe = new URL(request.url).searchParams.get("ready") === "1";
  if (isReadinessProbe) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redis = await getRedis();
      await redis.ping();
    } catch {
      return NextResponse.json({ status: "not_ready" }, { status: 503 });
    }
  }

  return NextResponse.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
