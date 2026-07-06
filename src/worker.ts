/**
 * Standalone BullMQ worker process.
 * Run with: pnpm worker
 */
import { startWorkers, getWorkers } from "@/lib/queue";

console.log("Starting BullMQ workers...");
startWorkers();
console.log("Workers started. Press Ctrl+C to stop.");

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down workers...`);
  const { workers, queues } = getWorkers();
  const timeout = setTimeout(() => {
    console.error("Shutdown timed out after 30s, forcing exit");
    process.exit(1);
  }, 30_000);

  try {
    await Promise.all([
      ...workers.map((w) => w.close()),
      ...queues.map((q) => q.close()),
    ]);
    console.log("Workers shut down gracefully");
  } catch (err) {
    console.error("Error during shutdown:", err);
  }
  clearTimeout(timeout);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
