import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { samlConfigSchema, type SamlConfig } from "../saml-schema";
import { logger } from "@/lib/logging";
import { decryptSecret } from "@/lib/webhook";

interface SamlAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
  error?: string;
}

async function getSamlConfig(): Promise<SamlConfig | null> {
  const setting = await prisma.settings.findFirst({
    where: { scope: "install", key: "saml" },
  });
  if (!setting?.valueJson) return null;

  try {
    const parsed = JSON.parse(setting.valueJson as string);
    const config = samlConfigSchema.parse(parsed);
    // Decrypt certificate if it's in encrypted format
    if (config.idpCertificate && config.idpCertificate.includes(":")) {
      config.idpCertificate = decryptSecret(config.idpCertificate);
    }
    return config;
  } catch {
    return null;
  }
}

export const samlProvider = {
  async startLogin(): Promise<{ redirectUrl: string }> {
    const config = await getSamlConfig();
    if (!config || !config.enabled) {
      throw new Error("SAML not configured");
    }

    const samlRequest = buildAuthnRequest(config);
    const redirectUrl = `${config.idpSsoUrl}?SAMLRequest=${encodeURIComponent(samlRequest)}`;

    return { redirectUrl };
  },

  async handleCallback(rawResponse: string): Promise<SamlAuthResult> {
    const config = await getSamlConfig();
    if (!config || !config.enabled) {
      return { success: false, error: "SAML not configured" };
    }

    try {
      const assertion = parseSamlResponse(rawResponse, config);

      const email = assertion.attributes[config.attributeMap.email];
      const displayName =
        assertion.attributes[config.attributeMap.displayName] ??
        email?.split("@")[0] ??
        assertion.nameId;

      if (!email) {
        return { success: false, error: "No email in SAML assertion" };
      }

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email } });

      if (user && user.status === "suspended") {
        return { success: false, error: "Account suspended" };
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            displayName: displayName ?? email,
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
          after: { email, provider: "saml" },
        });
      }

      // Upsert auth identity
      const existingIdentity = await prisma.authIdentity.findFirst({
        where: {
          provider: "saml",
          providerSubject: assertion.nameId,
        },
      });

      if (!existingIdentity) {
        await prisma.authIdentity.create({
          data: {
            userId: user.id,
            provider: "saml",
            providerSubject: assertion.nameId,
            providerIssuer: config.idpEntityId,
          },
        });

        await logAudit({
          actorUserId: user.id,
          action: "identity_linked",
          entityType: "authidentity",
          entityId: user.id,
          after: { provider: "saml" },
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
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error";
      logger.error({ error: errorMsg }, "SAML auth failed");
      return { success: false, error: errorMsg };
    }
  },
};

function buildAuthnRequest(config: SamlConfig): string {
  const id = `_${crypto.randomUUID()}`;
  const issueInstant = new Date().toISOString();

  const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${issueInstant}" AssertionConsumerServiceURL="${config.acsUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer>${config.entityId}</saml:Issuer><samlp:NameIDPolicy Format="${config.nameIdFormat}" AllowCreate="true"/></samlp:AuthnRequest>`;

  return Buffer.from(xml).toString("base64");
}

function parseSamlResponse(
  rawResponse: string,
  _config: SamlConfig,
): { nameId: string; attributes: Record<string, string> } {
  const decoded = Buffer.from(rawResponse, "base64").toString("utf8");

  const nameIdMatch = decoded.match(
    /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/,
  );
  const nameId = nameIdMatch?.[1] ?? "";

  const attributes: Record<string, string> = {};
  const attrMatches = decoded.matchAll(
    /<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g,
  );
  for (const match of attrMatches) {
    if (match[1] && match[2]) {
      attributes[match[1]] = match[2];
    }
  }

  return { nameId, attributes };
}
