import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { samlConfigSchema, type SamlConfig } from "../saml-schema";
import { logger } from "@/lib/logging";
import { decryptSecret } from "@/lib/webhook";
import { SignedXml } from "xml-crypto";
import { ensureDefaultOrganizationMembership } from "@/lib/organizations/context";

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
      const decoded = Buffer.from(rawResponse, "base64").toString("utf8");

      // Verify XML signature if configured
      if (config.wantResponseSigned || config.wantAssertionsSigned) {
        const sigVerified = verifySamlSignature(decoded, config);
        if (!sigVerified) {
          return { success: false, error: "SAML signature verification failed" };
        }
      }

      const assertion = extractAssertion(decoded);

      const email = assertion.attributes[config.attributeMap.email];
      const displayName =
        assertion.attributes[config.attributeMap.displayName] ??
        email?.split("@")[0] ??
        assertion.nameId;

      if (!email) {
        return { success: false, error: "No email in SAML assertion" };
      }

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

      await ensureDefaultOrganizationMembership(user.id);

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

function verifySamlSignature(xml: string, config: SamlConfig): boolean {
  try {
    const sig = new SignedXml({
      publicCert: config.idpCertificate,
      signatureAlgorithm: config.signatureAlgorithm as "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
      canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
    });

    // Find the <Signature> node in the document
    const sigNode = findSignatureNode(xml);
    if (!sigNode) {
      logger.warn("No XML signature found in SAML response");
      return false;
    }

    sig.loadSignature(sigNode);
    return sig.checkSignature(xml);
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : "unknown" }, "SAML signature verification error");
    return false;
  }
}

function findSignatureNode(xml: string): string | null {
  const sigMatch = xml.match(/<ds:Signature[\s\S]*?<\/ds:Signature>/);
  if (sigMatch) return sigMatch[0];

  // Try without namespace prefix
  const sigMatch2 = xml.match(/<Signature[\s\S]*?<\/Signature>/);
  if (sigMatch2) return sigMatch2[0];

  return null;
}

function buildAuthnRequest(config: SamlConfig): string {
  const id = `_${crypto.randomUUID()}`;
  const issueInstant = new Date().toISOString();

  const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${issueInstant}" AssertionConsumerServiceURL="${config.acsUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer>${config.entityId}</saml:Issuer><samlp:NameIDPolicy Format="${config.nameIdFormat}" AllowCreate="true"/></samlp:AuthnRequest>`;

  return Buffer.from(xml).toString("base64");
}

function extractAssertion(
  decoded: string,
): { nameId: string; attributes: Record<string, string> } {
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
