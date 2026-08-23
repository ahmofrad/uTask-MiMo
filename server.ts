import { createServer } from "http";
import net from "net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import next from "next";
import { recordHttpRequest } from "./src/lib/metrics";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

/**
 * Check whether the target port is already in use before Next.js starts its
 * long compile-and-listen phase. A clear early failure saves minutes of
 * "why is the page blank?" debugging when another process (e.g. a stale
 * `pnpm start` or a second `pnpm dev`) already owns the port.
 */
async function ensurePortFree(host: string, p: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${p} is already in use. Stop the process listening on port ${p} first, or set PORT=<other> in your environment.`,
          ),
        );
      }
      reject(err);
    });
    probe.once("listening", () => {
      probe.close();
      resolve();
    });
    probe.listen(p, host);
  });
}

/**
 * Warn when a production `.next` build directory is present while NODE_ENV
 * is not "production". This is the single most common cause of "JS/CSS 404
 * in dev" — the dev server picks up stale production build artifacts and the
 * RSC manifest / webpack cache becomes corrupted. The dev server still starts,
 * but the log makes the root cause obvious.
 */
function warnProductionArtifactsInDev(): void {
  const buildId = join(".next", "BUILD_ID");
  const prodServer = join(".next", "standalone");
  if (dev && (existsSync(buildId) || existsSync(prodServer))) {
    console.warn(
      "\n⚠  WARNING: A production .next build directory was detected while NODE_ENV is not \"production\".\n" +
        "   The dev server may serve stale chunks, produce 404s for JS/CSS, or corrupt the RSC manifest.\n" +
        "   Recommended: rm -rf .next && pnpm dev\n",
    );
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

ensurePortFree(hostname, port)
  .then(() => {
    warnProductionArtifactsInDev();
    return app.prepare();
  })
  .then(async () => {
  const server = createServer(async (req, res) => {
    const startedAt = performance.now();
    try {
      await handle(req, res);
    } catch (err) {
      console.error("Request error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }));
      }
    } finally {
      recordHttpRequest(req.method ?? "UNKNOWN", req.url?.split("?")[0] ?? "unknown", res.statusCode, performance.now() - startedAt);
    }
  });

  // Prevent process crashes from unhandled errors
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
  });

  // Initialize Socket.IO
  try {
    const { initSocketIO } = await import("./src/lib/realtime/server");
    await initSocketIO(server);
  } catch (err) {
    console.error("Failed to initialize Socket.IO:", err);
  }

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err: unknown) => {
  console.error(typeof (err as Error)?.message === "string" ? (err as Error).message : err);
  process.exit(1);
});