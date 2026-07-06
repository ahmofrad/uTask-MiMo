/**
 * Standalone BullMQ worker process.
 * Run with: pnpm worker
 */
import { startWorkers } from "@/lib/queue";

console.log("Starting BullMQ workers...");
startWorkers();
console.log("Workers started. Press Ctrl+C to stop.");

// Keep process alive
process.on("SIGINT", () => {
  console.log("Shutting down workers...");
  process.exit(0);
});
