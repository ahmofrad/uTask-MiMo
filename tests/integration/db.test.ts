import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";

// Skip if DATABASE_URL is not set
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

maybe("Database schema", () => {
  it("prisma generate succeeds", () => {
    expect(() => execSync("npx prisma generate", { cwd: process.cwd() })).not.toThrow();
  });
});
