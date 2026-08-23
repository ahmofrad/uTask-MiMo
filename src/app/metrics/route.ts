import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { renderApplicationMetrics } from "@/lib/metrics";

function hasMetricsAccess(request: Request): boolean {
  const expected = process.env.METRICS_AUTH_TOKEN?.trim();
  if (!expected) return true;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export async function GET(request: Request) {
  if (!hasMetricsAccess(request)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  try {
    // The Prisma query event listener records this probe in the shared DB
    // histogram, proving the endpoint includes live database health.
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    // Metrics must remain scrapeable during a database outage.
  }

  return new Response(renderApplicationMetrics(), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
