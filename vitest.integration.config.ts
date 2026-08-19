import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    testTimeout: 30000,
    // Integration tests call route handlers in-process to exercise RBAC and
    // scoping logic — not the rate limiter (which has its own unit coverage).
    // Without this, parallel workers trip the Redis token limit and get 429s.
    env: {
      RATE_LIMIT_DISABLED: "true",
    },
    // Test files run serially: several suites mutate the same InstanceSetting
    // rows (working days, egress config), and parallel workers race each
    // other's read-modify-write cycles. The suite is small; serial is fine.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
