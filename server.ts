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
 * Production builds write to `.next-prod` (see next.config.mjs distDir), so
 * `next build` can never clobber the `.next` directory a running dev server
 * is serving. This guard still warns when a production artifact tree is found
 * during a dev run (e.g. from an older deployment copy) so the root cause of
 * "JS/CSS 404 in dev" stays obvious.
 */
const PROD_BUILD_DIR = ".next-prod";

function warnProductionArtifactsInDev(): void {
  const buildId = join(PROD_BUILD_DIR, "BUILD_ID");
  const prodServer = join(PROD_BUILD_DIR, "standalone");
  if (dev && (existsSync(buildId) || existsSync(prodServer))) {
    console.warn(
      `\n⚠  WARNING: A production ${PROD_BUILD_DIR} directory was detected while NODE_ENV is not "production".\n` +
        `   The dev server uses ./next and is unaffected, but the production build lives in ${PROD_BUILD_DIR}.\n` +
        "   If you meant to run production, use NODE_ENV=production.\n",
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