/**
 * Bundles the server + worker entrypoints into single-file CJS artifacts
 * for the production image (which does not copy the full src/ tree).
 *
 * Local packages (Next, Prisma, Socket.IO, BullMQ, ...) stay external and
 * resolve from node_modules at runtime; only src/ code is inlined, with the
 * "@/" path alias resolved at build time by esbuild via tsconfig.json.
 */
import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  packages: "external",
  tsconfig: "tsconfig.json",
  minify: true,
  sourcemap: false,
  logLevel: "info",
};

await build({ ...shared, entryPoints: ["server.ts"], outfile: "dist/server.js" });
await build({ ...shared, entryPoints: ["src/worker.ts"], outfile: "dist/worker.js" });