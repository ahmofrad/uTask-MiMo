import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

/**
 * Integration coverage for the LDAP auto-migration: a legacy single-source
 * config stored as a `Settings` blob (scope=install, key=ldap) is migrated
 * into the first `LdapSource` row and existing AD-synced groups are backfilled
 * with that source's id. Runs the exact DO block from the real migration file
 * against the live database.
 */
maybe("LDAP auto-migration (settings.ldap -> first LdapSource)", () => {
  const suffix = `${Date.now()}`;
  const legacyBlob = {
    enabled: true,
    url: "ldaps://legacy.company.local:636",
    bindUpn: "svc-legacy@company.local",
    bindPassword: "legacy-secret",
    upnSuffix: "@company.local",
    searchBase: "OU=Users,DC=company,DC=local",
    emailAttribute: "mail",
    nameAttribute: "cn",
    defaultRole: "member",
    syncIntervalHours: 24,
    tlsCaCert: "-----BEGIN CERTIFICATE-----\nlegacy\n-----END CERTIFICATE-----",
  };

  let legacyGroupId = "";
  let manualGroupId = "";
  let migratedSourceId = "";

  function migrationDoBlock(): string {
    const sql = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20260816113911_ldap_sources/migration.sql"),
      "utf8",
    );
    // Extract the `DO $$ ... $$;` block that performs the auto-migration.
    const match = sql.match(/DO \$[\s\S]*?\$\$/);
    if (!match) throw new Error("auto-migration DO block not found in migration SQL");
    return match[0];
  }

  beforeAll(async () => {
    // Legacy AD-synced group (no source yet) + a manual group that must NOT be
    // backfilled.
    const legacyGroup = await prisma.ldapSyncGroup.create({
      data: { name: `Legacy Team ${suffix}`, dn: `cn=legacy-${suffix},dc=company,dc=local`, source: "ldap" },
    });
    legacyGroupId = legacyGroup.id;
    const manualGroup = await prisma.ldapSyncGroup.create({
      data: { name: `Manual Team ${suffix}`, source: "manual" },
    });
    manualGroupId = manualGroup.id;

    // Legacy settings blob exactly as the old SSO page wrote it. (Avoid the
    // upsert unique-lookup on scopeId=null — NULL never matches a unique index
    // in Postgres — so delete-then-create instead.)
    await prisma.settings.deleteMany({ where: { scope: "install", scopeId: null, key: "ldap" } });
    await prisma.settings.create({
      data: { scope: "install", scopeId: null, key: "ldap", valueJson: legacyBlob as never },
    });
  });

  afterAll(async () => {
    // Clean up migrated rows. The source's groups point at it; delete them first.
    if (migratedSourceId) {
      await prisma.ldapSyncGroup.deleteMany({ where: { sourceId: migratedSourceId } });
      await prisma.ldapSource.delete({ where: { id: migratedSourceId } }).catch(() => undefined);
    }
    if (legacyGroupId) await prisma.ldapSyncGroup.delete({ where: { id: legacyGroupId } }).catch(() => undefined);
    if (manualGroupId) await prisma.ldapSyncGroup.delete({ where: { id: manualGroupId } }).catch(() => undefined);
    await prisma.settings.deleteMany({ where: { scope: "install", scopeId: null, key: "ldap" } }).catch(() => undefined);
  });

  it("creates the first LdapSource from the legacy blob with decrypted-fields mapping", async () => {
    await prisma.$executeRawUnsafe(migrationDoBlock());

    // The migration derives the name from upnSuffix verbatim (keeps the @).
    const migrated = await prisma.ldapSource.findFirst({
      where: { name: "@company.local" },
      orderBy: { createdAt: "desc" },
    });
    expect(migrated).not.toBeNull();
    migratedSourceId = migrated!.id;

    expect(migrated!.enabled).toBe(true);
    expect(migrated!.url).toBe("ldaps://legacy.company.local:636");
    expect(migrated!.bindUpn).toBe("svc-legacy@company.local");
    // Stored as-is (the migration copies the blob; encryption is the layer's
    // concern at read time — sourceToLdapConfig decrypts iv:ciphertext:tag).
    expect(migrated!.bindPassword).toBe("legacy-secret");
    expect(migrated!.upnSuffix).toBe("@company.local");
    expect(migrated!.searchBase).toBe("OU=Users,DC=company,DC=local");
    expect(migrated!.emailAttribute).toBe("mail");
    expect(migrated!.nameAttribute).toBe("cn");
    expect(migrated!.defaultRole).toBe("member");
    expect(migrated!.syncIntervalHours).toBe(24);
    expect(migrated!.tlsCaCert).toContain("legacy");
  });

  it("backfills sourceId on AD-synced groups only, never manual groups", async () => {
    const legacyGroup = await prisma.ldapSyncGroup.findUnique({ where: { id: legacyGroupId } });
    const manualGroup = await prisma.ldapSyncGroup.findUnique({ where: { id: manualGroupId } });

    expect(legacyGroup!.sourceId).toBe(migratedSourceId);
    expect(manualGroup!.sourceId).toBeNull();
  });

  it("reads the migrated source through the config layer (decrypts + redacts)", async () => {
    const { getLdapSource, sourceToLdapConfig, redactLdapSource } = await import("@/lib/auth/ldap-sources");
    const source = await getLdapSource(migratedSourceId);
    expect(source).not.toBeNull();

    const config = sourceToLdapConfig(source!);
    expect(config.url).toBe("ldaps://legacy.company.local:636");
    expect(config.bindUpn).toBe("svc-legacy@company.local");

    const redacted = redactLdapSource(source!);
    expect(redacted.bindPasswordConfigured).toBe(true);
    expect(JSON.stringify(redacted)).not.toContain("legacy-secret");
  });
});
