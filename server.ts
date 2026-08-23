import { createServer } from "http";
import next from "next";
import { recordHttpRequest } from "./src/lib/metrics";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
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
});
