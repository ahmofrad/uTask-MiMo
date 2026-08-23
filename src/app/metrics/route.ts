import { timingSafeEqual } from "node:crypto";
import { register } from "prom-client";

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

  const body = await register.metrics();
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": register.contentType },
  });
}
