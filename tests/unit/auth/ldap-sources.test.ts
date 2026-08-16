import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockFindFirst } = vi.hoisted(() => ({ mockFindMany: vi.fn(), mockFindFirst: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSource: { findMany: mockFindMany, findFirst: mockFindFirst },
  },
}));

// decryptSecret decrypts iv:ciphertext:tag via AES-256-GCM with the env key
process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "test-only-encryption-key";

import { decrypt } from "@/lib/crypto/encrypt";
import {
  listLdapSources,
  getLdapSource,
  getEnabledLdapSources,
  getFirstLdapSource,
  getFirstEnabledLdapSource,
  sourceToLdapConfig,
  redactLdapSource,
  deriveLdapSourceName,
} from "@/lib/auth/ldap-sources";

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "src-1",
    name: "corp.local",
    enabled: true,
    url: "ldaps://dc.corp.local:636",
    bindUpn: "svc@corp.local",
    bindPassword: "iv:ciphertext:tag",
    upnSuffix: "@corp.local",
    searchBase: "DC=corp,DC=local",
    emailAttribute: "mail",
    nameAttribute: "cn",
    defaultRole: "member",
    syncIntervalHours: 6,
    tlsCaCert: "cert",
    lastSyncedAt: null,
    lastSyncError: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listLdapSources", () => {
  it("lists non-deleted sources ordered by creation", async () => {
    mockFindMany.mockResolvedValue([makeSource()]);
    await listLdapSources();
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("getEnabledLdapSources", () => {
  it("filters to enabled non-deleted sources", async () => {
    mockFindMany.mockResolvedValue([]);
    await getEnabledLdapSources();
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, enabled: true },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("getFirstLdapSource / getFirstEnabledLdapSource", () => {
  it("returns the first non-deleted source for admin display", async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    await expect(getFirstLdapSource()).resolves.toMatchObject({ id: "src-1" });
  });

  it("returns the first enabled source for auth/sync compat", async () => {
    mockFindMany.mockResolvedValue([makeSource(), makeSource({ id: "src-2" })]);
    await expect(getFirstEnabledLdapSource()).resolves.toMatchObject({ id: "src-1" });
  });

  it("returns null when no enabled sources exist", async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(getFirstEnabledLdapSource()).resolves.toBeNull();
  });
});

describe("getLdapSource", () => {
  it("reads a single source by id, excluding deleted", async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    await getLdapSource("src-1");
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "src-1", deletedAt: null },
    });
  });
});

describe("sourceToLdapConfig", () => {
  it("maps the row to the runtime config with the bind password decrypted", async () => {
    const encrypted = await (async () => {
      const { encrypt } = await import("@/lib/crypto/encrypt");
      const payload = encrypt("real-secret");
      return `${payload.iv}:${payload.ciphertext}:${payload.tag}`;
    })();

    const config = sourceToLdapConfig(makeSource({ bindPassword: encrypted }));

    expect(config).toMatchObject({
      enabled: true,
      url: "ldaps://dc.corp.local:636",
      bindUpn: "svc@corp.local",
      bindPassword: "real-secret",
      upnSuffix: "@corp.local",
      searchBase: "DC=corp,DC=local",
      emailAttribute: "mail",
      nameAttribute: "cn",
      defaultRole: "member",
      syncIntervalHours: 6,
      tlsCaCert: "cert",
    });
  });

  it("accepts legacy plaintext passwords", () => {
    const config = sourceToLdapConfig(makeSource({ bindPassword: "plain-secret" }));
    expect(config.bindPassword).toBe("plain-secret");
  });

  it("treats null optionals as undefined", () => {
    // plaintext password so decryptSecret passes it through untouched
    const config = sourceToLdapConfig(makeSource({ bindPassword: "plain-secret", upnSuffix: null, searchBase: null, tlsCaCert: null }));
    expect(config.upnSuffix).toBeUndefined();
    expect(config.searchBase).toBeUndefined();
    expect(config.tlsCaCert).toBeUndefined();
  });
});

describe("redactLdapSource", () => {
  it("never exposes the stored password, only its presence", () => {
    const redacted = redactLdapSource(makeSource());
    expect(redacted).not.toHaveProperty("bindPassword");
    expect(redacted.bindPasswordConfigured).toBe(true);
    expect(redacted.url).toBe("ldaps://dc.corp.local:636");
  });

  it("reports bindPasswordConfigured false when empty", () => {
    const redacted = redactLdapSource(makeSource({ bindPassword: "" }));
    expect(redacted.bindPasswordConfigured).toBe(false);
  });
});

describe("deriveLdapSourceName", () => {
  it("prefers the upnSuffix", () => {
    expect(deriveLdapSourceName({ upnSuffix: "@corp.local", bindUpn: "svc@x.local", url: "ldaps://h" }))
      .toBe("corp.local");
  });

  it("falls back to the bind UPN domain", () => {
    expect(deriveLdapSourceName({ bindUpn: "svc@corp.local", url: "ldaps://h" }))
      .toBe("corp.local");
  });

  it("falls back to the URL host", () => {
    expect(deriveLdapSourceName({ url: "ldaps://dc.corp.local:636" })).toBe("dc.corp.local");
  });

  it("falls back to a generic label", () => {
    expect(deriveLdapSourceName({})).toBe("Active Directory");
  });
});

// silence unused import in some vitest configs
void decrypt;
