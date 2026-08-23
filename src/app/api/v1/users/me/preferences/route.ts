import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { problemResponse } from "@/lib/api/problem";
import { logAudit } from "@/lib/audit/log";
import { can } from "@/lib/rbac/can";
import { z } from "zod";

const bodySchema = z.object({
  timeZone: z.string().max(64).nullable().optional(),
  timeFormat: z.enum(["H12", "H24"]).optional(),
  dualCalendar: z.boolean().optional(),
  locale: z.enum(["FA_IR", "EN_US"]).optional(),
  theme: z.enum(["light", "dark", "system", "midnight", "solarized", "high_contrast", "nord"]).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  accentColor: z.string().max(9).regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return problemResponse(request, 401, "UNAUTHORIZED", "Authentication required");
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return problemResponse(request, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request body");
  }

  // Self-service: users may update their own preferences (settings:update covers
  // all non-guest roles; the route itself is /me so only the owner can reach it).
  const hasPermission = await can(session.user.id, "settings:update");
  if (!hasPermission) {
    return problemResponse(request, 403, "FORBIDDEN", "You do not have permission to update these preferences");
  }

  // Validate IANA timezone if provided
  if (parsed.data.timeZone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timeZone });
    } catch {
      return problemResponse(request, 400, "INVALID_TIMEZONE", `"${parsed.data.timeZone}" is not a valid IANA timezone`);
    }
  }

  // Strip undefined values for Prisma + exactOptionalPropertyTypes
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) data[k] = v;
  }

  const before = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      timeZone: true,
      timeFormat: true,
      dualCalendar: true,
      locale: true,
      theme: true,
      density: true,
      accentColor: true,
    },
  });

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      timeZone: true,
      timeFormat: true,
      dualCalendar: true,
      locale: true,
      theme: true,
      density: true,
      accentColor: true,
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "user_updated",
    entityType: "user",
    entityId: session.user.id,
    before: before as never,
    after: updated as never,
  });

  return NextResponse.json({ data: updated });
}