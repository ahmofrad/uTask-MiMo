import { request as httpsRequest } from "node:https";
import type { ResolvedWebhookAddress } from "./ssrf";

export function postWebhookRequest(
  url: string,
  body: string,
  headers: Record<string, string>,
  resolvedAddress: ResolvedWebhookAddress,
): Promise<{ status: number; body: string }> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  const requestOptions = {
    hostname: resolvedAddress.address,
    port: parsed.port ? Number(parsed.port) : 443,
    path: `${parsed.pathname}${parsed.search}`,
    method: "POST" as const,
    headers: {
      ...headers,
      Host: parsed.host,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    timeout: 10_000,
  };

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      { ...requestOptions, servername: hostname },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (size < 10_000) {
            const remaining = 10_000 - size;
            chunks.push(buffer.subarray(0, remaining));
            size += Math.min(buffer.length, remaining);
          }
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 502,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Webhook request timed out")));
    request.on("error", reject);
    request.end(body);
  });
}