import { Client } from "ldapts";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { ldapConfigSchema, type LdapConfig } from "../ldap-schema";
import { logger } from "@/lib/logging";
import { decryptSecret } from "@/lib/webhook";

interface LdapAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
  error?: string;
}

function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/\*/g, "\\2a")
    .replace(/\(/g, "\\28")
    .replace(/\)/g, "\\29")
    .replace(/\0/g, "\\00");
}

async function getLdapConfig(): Promise<LdapConfig | null> {
  const setting = await prisma.settings.findFirst({
    where: { scope: "install", key: "ldap" },
  });
  if (!setting?.valueJson) return null;

  try {
    const parsed = JSON.parse(setting.valueJson as string);
    return ldapConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function ldapAuth(
  username: string,
  password: string,
): Promise<LdapAuthResult> {
  const config = await getLdapConfig();
  if (!config || !config.enabled) {
    return { success: false, error: "LDAP not configured" };
  }

  // Decrypt bindPassword if it's in encrypted format
  const bindPassword = config.bindPassword.includes(":")
    ? decryptSecret(config.bindPassword)
    : config.bindPassword;

  let client: Client | null = null;
  try {
    const clientOpts: ConstructorParameters<typeof Client>[0] = {
      url: config.url,
    };

    if (config.tlsCaCert) {
      clientOpts.tlsOptions = {
        ca: config.tlsCaCert,
        rejectUnauthorized: true,
      };
    }

    client = new Client(clientOpts);

    // Bind with service account
    await client.bind(config.bindDn, bindPassword);

    // Search for user
    const escapedUsername = escapeLdapFilter(username);
    const filter = config.searchFilter.replace(
      /\{\{username\}\}/g,
      escapedUsername,
    );

    const searchResult = await client.search(config.searchBase, {
      filter,
      scope: "sub",
      sizeLimit: 1,
    });

    if (searchResult.searchEntries.length === 0) {
      await client.unbind();
      return { success: false, error: "User not found" };
    }

    const entry = searchResult.searchEntries[0]!;
    const userDN = entry.dn;
    const email =
      entry[config.emailAttribute]?.toString() ?? `${username}@ldap.local`;
    const displayName =
      entry[config.nameAttribute]?.toString() ?? username;

    // Bind as the found user to verify password
    await client.bind(userDN, password);
    await client.unbind();

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.status === "suspended") {
      return { success: false, error: "Account suspended" };
    }

    if (!user) {
      // JIT create user
      user = await prisma.user.create({
        data: {
          email,
          displayName,
          passwordHash: null,
          locale: "fa_IR",
          status: "active",
        },
      });

      await logAudit({
        actorUserId: null,
        action: "user_jit_created",
        entityType: "user",
        entityId: user.id,
        after: { email, provider: "ldap" },
      });
    }

    // Upsert auth identity
    const existingIdentity = await prisma.authIdentity.findFirst({
      where: { provider: "ldap", providerSubject: userDN },
    });

    if (!existingIdentity) {
      await prisma.authIdentity.create({
        data: {
          userId: user.id,
          provider: "ldap",
          providerSubject: userDN,
        },
      });

      await logAudit({
        actorUserId: user.id,
        action: "identity_linked",
        entityType: "authidentity",
        entityId: user.id,
        after: { provider: "ldap" },
      });
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ error: errorMsg }, "LDAP auth failed");

    if (client) {
      try {
        await client.unbind();
      } catch {
        // Ignore unbind errors
      }
    }

    return { success: false, error: errorMsg };
  }
}
