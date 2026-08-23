import { test, expect, describe } from "vitest";
import fs from "fs";
import path from "path";

const API_V1_DIR = path.resolve(process.cwd(), "src/app/api/v1");
const PUBLIC_DIR = path.join(API_V1_DIR, "public");
const AUTH_DIR = path.join(API_V1_DIR, "auth");
const HEALTH_FILE = path.join(API_V1_DIR, "health/route.ts");

// --- Glob helpers ---

function getAllRouteFiles(dir: string, excludeDirs: string[] = []): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        results.push(...getAllRouteFiles(fullPath, excludeDirs));
      }
    } else if (entry.name.endsWith(".ts") && entry.name !== "layout.tsx") {
      results.push(fullPath);
    }
  }
  return results;
}

function readFile(p: string): string {
  return fs.readFileSync(p, "utf-8");
}

// --- Constants ---

const EXPORTED_FN_RE = /export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\s*\(/g;
const AUTH_RE = /await\s+(auth|requireAuth)\s*\(/;
const STUB_501_RE = /status:\s*501/;
const CAN_RE = /\b(can|canProject|canCreateProject|canReadProject|canReadTask|canEditTask|canManageGroup|requirePermission|requireAnyPermission)\s*\(/;
const LOG_AUDIT_RE = /\blogAudit\s*\(/;
const PRISMA_MUTATE_RE = /prisma\.\w+\.(create|update|delete|upsert)\s*\(/;
const PUBLIC_AUTH_RE = /authenticatePublicApi\s*\(/;
const SOFT_DELETE_RE = /data\s*:\s*\{\s*deletedAt/;
const PRISMA_DELETE_DIRECT_RE = /prisma\.\w+\.delete\s*\(/;

type ExportedFn = { method: string; body: string; lineStart: number };

/**
 * Extract exported async functions from file content. Works correctly
 * even when the function has destructured parameters (nested braces).
 *
 * Strategy: find "export async function METHOD (", locate the closing
 * paren of the parameter list, then the opening "{" of the function
 * body, then walk the brace depth to find the matching "}".
 */
function extractExportedFns(content: string): ExportedFn[] {
  const fns: ExportedFn[] = [];
  let match: RegExpExecArray | null;
  while ((match = EXPORTED_FN_RE.exec(content)) !== null) {
    const method = match[1]!;
    const fnStart = match.index;

    // 1. find the closing paren of the parameter list
    const afterKeyword = match.index + match[0].length;
    const closeParen = findClosingParen(content, afterKeyword);
    if (closeParen === -1) continue;

    // 2. opening brace of the body (the "{" after "){")
    const bodyOpen = content.indexOf("{", closeParen + 1);
    if (bodyOpen === -1) continue;

    // 3. walk brace depth
    let depth = 0;
    let bodyClose = -1;
    for (let i = bodyOpen; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          bodyClose = i;
          break;
        }
      }
    }
    if (bodyClose === -1) continue;

    const body = content.slice(bodyOpen, bodyClose + 1);
    const lineStart = content.slice(0, fnStart).split("\n").length;
    fns.push({ method, body, lineStart });
  }
  return fns;
}

function findClosingParen(content: string, start: number): number {
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === "(") depth++;
    else if (content[i] === ")") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function getRelativePath(p: string): string {
  return path.relative(API_V1_DIR, p);
}

// --- Collect files eagerly (not in beforeAll, so test.each receives them) ---

const allRouteFiles = getAllRouteFiles(API_V1_DIR);

const internalRouteFiles = allRouteFiles.filter(
  (f) =>
    !f.startsWith(PUBLIC_DIR) &&
    !f.startsWith(AUTH_DIR) &&
    f !== HEALTH_FILE,
);

const publicRouteFiles = allRouteFiles.filter((f) =>
  f.startsWith(PUBLIC_DIR),
);

// =====================================================
// 1. Auth checks on internal API routes
// =====================================================
describe("auth checks on internal API routes", () => {
  if (internalRouteFiles.length === 0) {
    test("at least one internal route file exists", () => {
      expect(internalRouteFiles.length).toBeGreaterThan(0);
    });
  } else {
    test.each(internalRouteFiles)(
      "%s",
      (filePath) => {
        const content = readFile(filePath);
        const fns = extractExportedFns(content);
        expect(fns.length).toBeGreaterThan(0);

        for (const fn of fns) {
          const hasAuth = AUTH_RE.test(fn.body);
          const is501 = STUB_501_RE.test(fn.body);
          expect(
            { file: getRelativePath(filePath), method: fn.method, line: fn.lineStart },
          ).toSatisfy(
            () => hasAuth || is501,
            `Missing auth() call and not a 501 stub`,
          );
        }
      },
    );
  }
});

// =====================================================
// 2. RBAC checks on mutation routes
// =====================================================
describe("RBAC checks on mutation routes", () => {
  const mutationFiles = internalRouteFiles.filter((f) => {
    const content = readFile(f);
    return PRISMA_MUTATE_RE.test(content);
  });

  if (mutationFiles.length === 0) {
    test("at least one mutation file exists", () => {
      expect(mutationFiles.length).toBeGreaterThan(0);
    });
  } else {
    test.each(mutationFiles)("%s", (filePath) => {
      const content = readFile(filePath);
      const fns = extractExportedFns(content);

      for (const fn of fns) {
        const hasMutation = PRISMA_MUTATE_RE.test(fn.body);
        if (!hasMutation) continue;

        const hasRBAC = CAN_RE.test(fn.body);
        const is501 = STUB_501_RE.test(fn.body);
        expect(
          { file: getRelativePath(filePath), method: fn.method, line: fn.lineStart },
        ).toSatisfy(
          () => hasRBAC || is501,
          `Mutation calls prisma create/update/delete but lacks can()/requirePermission()`,
        );
      }
    });
  }
});

// =====================================================
// 3. Audit logging on mutation routes
// =====================================================
describe("audit logging on mutation routes", () => {
  const mutationFiles = internalRouteFiles.filter((f) => {
    const content = readFile(f);
    return PRISMA_MUTATE_RE.test(content);
  });

  if (mutationFiles.length === 0) {
    test("at least one mutation file exists", () => {
      expect(mutationFiles.length).toBeGreaterThan(0);
    });
  } else {
    test.each(mutationFiles)("%s", (filePath) => {
      const content = readFile(filePath);
      const fns = extractExportedFns(content);

      for (const fn of fns) {
        const hasMutation = PRISMA_MUTATE_RE.test(fn.body);
        if (!hasMutation) continue;

        const hasAudit = LOG_AUDIT_RE.test(fn.body);
        const is501 = STUB_501_RE.test(fn.body);
        expect(
          { file: getRelativePath(filePath), method: fn.method, line: fn.lineStart },
        ).toSatisfy(
          () => hasAudit || is501,
          `Mutation calls prisma create/update/delete but lacks logAudit()`,
        );
      }
    });
  }
});

// =====================================================
// 4. Public API scope checks
// =====================================================
describe("public API scope / auth checks", () => {
  const publicRouteFilesNoDocs = publicRouteFiles.filter(
    (f) =>
      !f.includes("/docs/") &&
      !f.includes("/openapi.json/") &&
      !f.endsWith("/public/route.ts"),
  );

  if (publicRouteFilesNoDocs.length === 0) {
    test("at least one public route file exists", () => {
      expect(publicRouteFiles.length).toBeGreaterThan(0);
    });
  } else {
    test.each(publicRouteFilesNoDocs)("%s", (filePath) => {
      const content = readFile(filePath);
      const fns = extractExportedFns(content);
      expect(fns.length).toBeGreaterThan(0);

      for (const fn of fns) {
        const hasAuth = PUBLIC_AUTH_RE.test(fn.body);
        expect(
          { file: getRelativePath(filePath), method: fn.method, line: fn.lineStart },
        ).toSatisfy(
          () => hasAuth,
          `Public API function missing authenticatePublicApi()`,
        );
      }
    });
  }
});

// =====================================================
// 5. Security headers in middleware / lib
// =====================================================
describe("security headers", () => {
  const headersFilePath = path.resolve(
    process.cwd(),
    "src/lib/security/headers.ts",
  );

  test("src/lib/security/headers.ts defines Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options", () => {
    const content = readFile(headersFilePath);
    const required = [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
    ];
    for (const h of required) {
      expect(
        { header: h, file: "src/lib/security/headers.ts" },
      ).toSatisfy(() => content.includes(h));
    }
  });

  test("src/middleware.ts imports applySecurityHeaders", () => {
    const middlewareContent = readFile(
      path.resolve(process.cwd(), "src/middleware.ts"),
    );
    expect(middlewareContent).toContain("applySecurityHeaders");
  });
});

// =====================================================
// 6. Departments use soft-delete
// =====================================================
describe("departments use soft-delete", () => {
  const deptWrapperFile = path.resolve(
    process.cwd(),
    "src/lib/departments/index.ts",
  );

  test("departments domain wrapper uses update with deletedAt instead of prisma.delete", () => {
    const content = readFile(deptWrapperFile);

    const hasSoftDelete = SOFT_DELETE_RE.test(content);
    const hasHardDelete = PRISMA_DELETE_DIRECT_RE.test(content);

    expect(
      { file: "lib/departments/index.ts", method: "deleteDepartment" },
    ).toSatisfy(() => hasSoftDelete);
    expect(
      { file: "lib/departments/index.ts", method: "deleteDepartment" },
    ).toSatisfy(() => !hasHardDelete);
  });
});
