import { prisma } from "@/lib/db";
import {
  parsePaginationParams,
  buildPaginatedMeta,
  type PaginatedResult,
} from "@/lib/db/pagination";
import type { Locale } from "@prisma/client";
import bcrypt from "bcryptjs";

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  locale: true,
  accentColor: true,
  theme: true,
  density: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  roles: {
    where: { scopeType: "global" as const },
    select: { type: true },
  },
} as const;

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT,
      ownedProjects: { select: { id: true, name: true } },
    },
  });
}

export async function listUsers(params: {
  cursor?: string;
  limit?: number;
  status?: string;
  role?: string;
}): Promise<PaginatedResult<Record<string, unknown>>> {
  const { take, skip, cursor, limit } = parsePaginationParams(params);

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.role) {
    where.roles = { some: { type: params.role, scopeType: "global" } };
  }

  const users = await prisma.user.findMany({
    where,
    take,
    skip,
    ...(cursor ? { cursor } : {}),
    orderBy: { createdAt: "desc" },
    select: USER_SELECT,
  });

  return {
    data: users as unknown as Record<string, unknown>[],
    meta: buildPaginatedMeta(users as unknown as { id: string }[], limit),
  };
}

export async function createUser(data: {
  email: string;
  displayName: string;
  password?: string;
  locale?: Locale;
}) {
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 12)
    : null;

  const user = data.locale
    ? await prisma.user.create({
        data: {
          email: data.email,
          displayName: data.displayName,
          passwordHash,
          status: data.password ? "active" : "invited",
          locale: data.locale,
        },
      })
    : await prisma.user.create({
        data: {
          email: data.email,
          displayName: data.displayName,
          passwordHash,
          status: data.password ? "active" : "invited",
        },
      });

  return user;
}

export async function suspendUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "suspended" },
  });
}

export async function restoreUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "active" },
  });
}
