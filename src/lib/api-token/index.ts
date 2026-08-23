import { sha256, randomBytes } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac/roles";

const TOKEN_PREFIX = "tk_";

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(32);
  const raw = TOKEN_PREFIX + bytes.toString("base64url");
  const hash = sha256(raw);
  const prefix = TOKEN_PREFIX + raw.slice(3, 7);
  return { raw, hash, prefix };
}

export async function createApiToken(params: {
  userId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date | null;
}) {
  const { raw, hash, prefix } = generateToken();

  const token = await prisma.apiToken.create({
    data: {
      userId: params.userId,
      name: params.name,
      hashedToken: hash,
      prefix,
      scopes: params.scopes,
      expiresAt: params.expiresAt ?? null,
    },
  });

  return { raw, prefix, id: token.id };
}

export async function revokeApiToken(tokenId: string, userId: string) {
  const result = await prisma.apiToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count !== 1) {
    const error = new Error("API token not found") as Error & { code?: string };
    error.code = "NOT_FOUND";
    throw error;
  }
  return { success: true };
}

export async function lookupToken(rawToken: string) {
  const hash = sha256(rawToken);

  const token = await prisma.apiToken.findUnique({
    where: { hashedToken: hash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          roles: {
            where: { scopeType: "global" },
            select: { type: true },
          },
        },
      },
    },
  });

  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;
  if (token.user.status !== "active") return null;

  // Update last used
  await prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return token;
}

export const PUBLIC_SCOPES = [
  "tasks:read",
  "tasks:write",
  "projects:read",
  "projects:write",
  "users:read",
  "users:write",
  "comments:write",
  "webhooks:manage",
] as const;

export type PublicScope = (typeof PUBLIC_SCOPES)[number];

export function tokenHasScope(tokenScopes: string[], requiredScope: string): boolean {
  return tokenScopes.includes(requiredScope);
}

/**
 * Maps each public API scope to the global permission(s) a user must hold in
 * order to mint a token carrying that scope. Scopes with an empty list are
 * read scopes grantable by any active, authenticated user (actual data access
 * is still bounded by per-request RBAC). This prevents privilege escalation:
 * a user can only delegate capabilities they already possess.
 */
export const SCOPE_PERMISSIONS: Record<PublicScope, Permission[]> = {
  "tasks:read": [],
  "tasks:write": ["task:create", "task:edit_any", "task:edit_own"],
  "projects:read": [],
  "projects:write": ["project:create"],
  "users:read": ["user:manage"],
  "users:write": ["user:manage"],
  "comments:write": ["comment:create"],
  "webhooks:manage": ["webhook:manage"],
};

/** Normalize a request body `scopes` value into a de-duplicated string array. */
export function normalizeScopes(scopes: unknown): string[] | null {
  if (!Array.isArray(scopes)) return null;
  const out = Array.from(
    new Set(scopes.filter((s): s is string => typeof s === "string" && s.length > 0)),
  );
  return out;
}

/** Return the subset of `scopes` that are not part of the allowlist. */
export function invalidScopes(scopes: string[]): string[] {
  return scopes.filter((s) => !PUBLIC_SCOPES.includes(s as PublicScope));
}

/** Whether the user is entitled to grant the given (allowlisted) scope. */
export async function userCanGrantScope(userId: string, scope: string): Promise<boolean> {
  const required = SCOPE_PERMISSIONS[scope as PublicScope];
  if (!required) return false;
  if (required.length === 0) return true;
  for (const perm of required) {
    if (await can(userId, perm)) return true;
  }
  return false;
}
