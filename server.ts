import { createServer } from "http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    handle(req, res);
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
