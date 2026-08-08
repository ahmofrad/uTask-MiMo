import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("Database schema", () => {
  it("prisma generate succeeds", () => {
    expect(() => execSync("npx prisma generate", { cwd: process.cwd() })).not.toThrow();
  });
});
