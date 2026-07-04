import crypto from "crypto";
import { prisma } from "@/lib/db";

const TOKEN_PREFIX = "tk_";

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(32);
  const raw = TOKEN_PREFIX + randomBytes.toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
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
  return prisma.apiToken.update({
    where: { id: tokenId, userId },
    data: { revokedAt: new Date() },
  });
}

export async function lookupToken(rawToken: string) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

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
