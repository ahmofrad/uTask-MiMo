import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { encrypt } from "@/lib/crypto/encrypt";
import { getLdapSource, redactLdapSource } from "@/lib/auth/ldap-sources";
import { ldapSourceUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { id } = await params;
  const source = await getLdapSource(id);
  if (!source) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "LDAP source not found" } }, { status: 404 });
  }
  return NextResponse.json({ data: redactLdapSource(source) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { id } = await params;
  const existing = await getLdapSource(id);
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "LDAP source not found" } }, { status: 404 });
  }

  const parsed = ldapSourceUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const data = parsed.data;

  const before = redactLdapSource(existing);
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  if (data.url !== undefined) patch.url = data.url || "";
  if (data.bindUpn !== undefined) patch.bindUpn = data.bindUpn;
  if (data.bindPassword !== undefined && data.bindPassword !== "") {
    const enc = encrypt(data.bindPassword);
    patch.bindPassword = `${enc.iv}:${enc.ciphertext}:${enc.tag}`;
  }
  if (data.upnSuffix !== undefined) patch.upnSuffix = data.upnSuffix || null;
  if (data.searchBase !== undefined) patch.searchBase = data.searchBase || null;
  if (data.emailAttribute !== undefined) patch.emailAttribute = data.emailAttribute;
  if (data.nameAttribute !== undefined) patch.nameAttribute = data.nameAttribute;
  if (data.defaultRole !== undefined) patch.defaultRole = data.defaultRole;
  if (data.syncIntervalHours !== undefined) patch.syncIntervalHours = data.syncIntervalHours;
  if (data.tlsCaCert !== undefined) patch.tlsCaCert = data.tlsCaCert || null;

  const updated = await prisma.ldapSource.update({ where: { id }, data: patch });
  const after = redactLdapSource(updated);

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "ldapsource",
    entityId: updated.id,
    before,
    after,
  });

  return NextResponse.json({ data: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { id } = await params;
  const existing = await getLdapSource(id);
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "LDAP source not found" } }, { status: 404 });
  }

  // Soft-delete the source; its AD groups keep their sourceId but are no
  // longer syncable until a source is re-linked.
  await prisma.ldapSource.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false },
  });

  await logAudit({
    actorUserId: userId,
    action: "deleted",
    entityType: "ldapsource",
    entityId: id,
    before: redactLdapSource(existing),
  });

  return NextResponse.json({ data: { success: true } });
}
