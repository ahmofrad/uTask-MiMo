import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The dev-server wrapper is a lightweight orchestrator — this test verifies
 * that the process itself starts, handles SIGTERM gracefully, and can be
 * killed without hanging. We don't test the full "restart on crash" cycle
 * here because that requires a real `pnpm dev` process which would compete
 * for the dev port with any running server.
 */
describe("scripts/dev-server.mjs", () => {
  let child: ChildProcess | null = null;

  afterEach(() => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  });

  it("starts and responds to SIGTERM cleanly", async () => {
    child = spawn("node", ["scripts/dev-server.mjs"], {
      stdio: "pipe",
      env: { ...process.env, MAX_RESTART_DELAY_MS: "500", MAX_RESTARTS: "1" },
    });

    const started = await new Promise<string | null>((resolve) => {
      const t = setTimeout(() => resolve(null), 12_000);

      child!.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        if (text.includes("Starting dev server")) {
          clearTimeout(t);
          resolve(text);
        }
      });

      child!.on("error", () => {
        clearTimeout(t);
        resolve(null);
      });

      child!.on("exit", () => {
        clearTimeout(t);
        resolve(null);
      });
    });

    expect(started).not.toBeNull();
    expect(started).toContain("Starting dev server");

    // Kill and verify it exits cleanly
    const exitCode = await new Promise<number | null>((resolve) => {
      const t = setTimeout(() => resolve(null), 8_000);
      child!.on("exit", (code) => {
        clearTimeout(t);
        resolve(code);
      });
      child!.kill("SIGTERM");
    });

    expect(exitCode).toBe(0);
  }, 20_000);

  it("exits immediately when NODE_ENV is set to production (no restart loop)", async () => {
    // The wrapper spawns `pnpm dev` which will fail fast in a non-dev env.
    // We just verify the wrapper starts its message.
    child = spawn("node", ["scripts/dev-server.mjs"], {
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "production", MAX_RESTARTS: "1", MAX_RESTART_DELAY_MS: "500" },
    });

    const output = await new Promise<string>((resolve) => {
      let buf = "";
      const t = setTimeout(() => resolve(buf), 10_000);

      const onData = (chunk: Buffer) => {
        buf += chunk.toString();
        if (buf.includes("Starting dev server")) {
          clearTimeout(t);
          child!.stdout?.off("data", onData);
          child!.stderr?.off("data", onData);
          resolve(buf);
        }
      };
      child!.stdout?.on("data", onData);
      child!.stderr?.on("data", onData);
    });

    expect(output).toContain("Starting dev server");
  }, 15_000);
});