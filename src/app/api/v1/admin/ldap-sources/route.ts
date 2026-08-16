import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { encrypt } from "@/lib/crypto/encrypt";
import { listLdapSources, redactLdapSource } from "@/lib/auth/ldap-sources";
import { ldapSourceCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const sources = await listLdapSources();
  return NextResponse.json({ data: sources.map((source) => redactLdapSource(source)) });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = ldapSourceCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const data = parsed.data;

  const enc = encrypt(data.bindPassword);
  const source = await prisma.ldapSource.create({
    data: {
      name: data.name,
      enabled: data.enabled,
      url: data.url,
      bindUpn: data.bindUpn,
      bindPassword: `${enc.iv}:${enc.ciphertext}:${enc.tag}`,
      upnSuffix: data.upnSuffix || null,
      searchBase: data.searchBase || null,
      emailAttribute: data.emailAttribute,
      nameAttribute: data.nameAttribute,
      defaultRole: data.defaultRole,
      syncIntervalHours: data.syncIntervalHours,
      tlsCaCert: data.tlsCaCert || null,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "created",
    entityType: "ldapsource",
    entityId: source.id,
    after: { name: source.name, url: source.url, enabled: source.enabled },
  });

  return NextResponse.json({ data: redactLdapSource(source) }, { status: 201 });
}
