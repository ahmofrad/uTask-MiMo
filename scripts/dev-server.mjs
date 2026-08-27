#!/usr/bin/env node

/**
 * Dev server launcher with auto-restart on crash.
 *
 * Usage:
 *   node scripts/dev-server.mjs [--delay <ms>]
 *
 * Spawns `pnpm dev:core` and respawns it automatically when the child process
 * exits with a non-zero code. Useful when webpack cache corruption or a wiped
 * `.next` directory (see the watchdog in server.ts) kills the process in
 * environments where a terminal isn't available to restart manually.
 *
 * Set MAX_RESTART_DELAY_MS env var to cap the backoff (default 15000).
 * Set MAX_RESTARTS env var to limit total restarts (default 30).
 * Ctrl-C terminates both the wrapper and the child.
 */

import { spawn } from "node:child_process";
import { exit, argv } from "node:process";

const DELAY_ARG = argv.indexOf("--delay");
const FIXED_DELAY =
  DELAY_ARG !== -1 && DELAY_ARG + 1 < argv.length ? parseInt(argv[DELAY_ARG + 1], 10) : null;
const MAX_DELAY = parseInt(process.env.MAX_RESTART_DELAY_MS ?? "15000", 10);
const MAX_RESTARTS = parseInt(process.env.MAX_RESTARTS ?? "30", 10);

let restartCount = 0;

function ts() {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function spawnDev() {
  // Spawn dev:core (the raw server) rather than `pnpm dev` so the wrapper
  // doesn't recurse into itself now that `pnpm dev` routes through it.
  const child = spawn("pnpm", ["dev:core"], {
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  console.log(`[dev-server] [${ts()}] Spawned dev:core (pid ${child.pid})`);

  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") {
      console.log(`[dev-server] [${ts()}] Child killed by signal ${signal}, exiting wrapper.`);
      exit(0);
    }

    restartCount++;
    if (restartCount > MAX_RESTARTS) {
      console.error(
        `[dev-server] [${ts()}] Reached maximum restarts (${MAX_RESTARTS}). Exiting.`
      );
      exit(1);
    }

    const delay = FIXED_DELAY ?? Math.min(1000 * Math.pow(2, Math.min(restartCount, 5)), MAX_DELAY);
    const reason = code === 1 ? ".next may have been wiped — watchdog triggered restart" : "clean exit";
    console.error(
      `[dev-server] [${ts()}] Child pid ${child.pid} exited with code ${code} (${reason}). Restarting in ${delay}ms (attempt ${restartCount}/${MAX_RESTARTS})…`
    );

    setTimeout(spawnDev, delay);
  });
}

process.on("SIGINT", () => exit(0));
process.on("SIGTERM", () => exit(0));

console.log(`[dev-server] [${ts()}] Starting dev server (auto-restart enabled, max ${MAX_RESTARTS})…`);
spawnDev();