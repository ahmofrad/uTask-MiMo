import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const allowPending = process.argv.includes("--allow-pending");
const requiredAlways = ["DATABASE_URL"];
const requiredProduction = ["AUTH_SECRET", "WEBHOOK_SECRET_ENCRYPTION_KEY"];
const expectedExtensions = ["citext", "pg_trgm", "pgcrypto"];

function fail(message: string): never {
  console.error(`Migration preflight failed: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  for (const key of requiredAlways) {
    if (!process.env[key]?.trim()) fail(`${key} is required`);
  }

  if (process.env.NODE_ENV === "production") {
    for (const key of requiredProduction) {
      if (!process.env[key]?.trim() || process.env[key]?.startsWith("change-me")) {
        fail(`${key} must be configured in production`);
      }
    }
  }

  const prismaBin = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );
  if (!existsSync(prismaBin)) fail("Prisma CLI is not installed");

  try {
    execFileSync(prismaBin, ["validate", "--schema", "prisma/schema.prisma"], {
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    fail("Prisma schema validation failed");
  }

  let statusOutput = "";
  try {
    statusOutput = execFileSync(prismaBin, ["migrate", "status", "--schema", "prisma/schema.prisma"], {
      encoding: "utf8",
      env: process.env,
    });
  } catch (error) {
    const output = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    statusOutput = `${output}\n${stderr}`;
    if (!/not yet applied|following migration/i.test(statusOutput)) {
      fail(`Prisma migration status could not be determined${stderr ? `: ${stderr.trim()}` : ""}`);
    }
  }

  const hasPending = /not yet applied|following migration/i.test(statusOutput);
  if (hasPending) {
    if (!allowPending) {
      console.error(statusOutput.trim());
      fail("pending migrations exist; run `pnpm prisma:deploy` or use --allow-pending");
    }
    console.warn("Migration preflight: pending migrations will be applied by the deployment step.");
  } else {
    console.log("Migration preflight: database schema is up to date.");
  }

  if (hasPending && allowPending) {
    console.warn("Migration preflight: extension verification deferred until migrations complete.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname
      FROM pg_extension
      WHERE extname IN ('citext', 'pg_trgm', 'pgcrypto')
    `;
    const installed = new Set(rows.map((row) => row.extname));
    for (const extension of expectedExtensions) {
      if (!installed.has(extension)) fail(`required PostgreSQL extension ${extension} is missing`);
    }
    console.log("Migration preflight: required PostgreSQL extensions are present.");
  } catch {
    if (process.env.NODE_ENV === "production") fail("could not verify required PostgreSQL extensions");
    console.warn("Migration preflight: extension verification skipped outside production.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : "unexpected preflight failure");
});
