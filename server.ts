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
 * Dev-mode watchdog: `next dev` reads .next/routes-manifest.json on every
 * request, so a wiped or partially-rebuilt `.next` (e.g. a `dev:clean` or an
 * interrupted build while the server is running) turns every request into a
 * 500 ENOENT until the process is restarted. Detect the missing manifest and
 * exit with a non-zero code so the auto-restart wrapper (scripts/dev-server.mjs)
 * respawns the server with a fresh compile instead of serving errors.
 */
function startDevBuildDirWatchdog(): void {
  if (!dev) return;

  const devBuildDir = join(process.cwd(), ".next");
  const routesManifest = join(devBuildDir, "routes-manifest.json");

  const check = setInterval(() => {
    if (existsSync(routesManifest)) return;
    console.error(
      `\n⚠  Dev build directory incomplete: ${routesManifest} is missing.` +
        "\n   The `.next` directory was likely wiped or a build was interrupted while the dev server was running." +
        "\n   Exiting so the auto-restart wrapper can respawn with a fresh compile.\n",
    );
    clearInterval(check);
    process.exit(1);
  }, 2000);

  // Don't keep the event loop alive for the watchdog alone in production
  // (unreachable today — dev only — but explicit is better).
  check.unref();
}

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
  startDevBuildDirWatchdog();
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