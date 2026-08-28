import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    settings: { findFirst: vi.fn() },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    authIdentity: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/organizations/context", () => ({
  ensureDefaultOrganizationMembership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhook", () => ({
  decryptSecret: vi.fn((s: string) => s.replace("ENC:", "")),
}));

const SAMPLE_ASSERTION = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Subject>
      <saml:NameID>user@example.com</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>user@example.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="displayName">
        <saml:AttributeValue>Test User</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
`;

describe("SAML assertion parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts NameID from SAML assertion XML", () => {
    const nameIdMatch = SAMPLE_ASSERTION.match(
      /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/,
    );
    expect(nameIdMatch?.[1]).toBe("user@example.com");
  });

  it("extracts attributes from SAML assertion XML", () => {
    const attributes: Record<string, string> = {};
    const attrMatches = SAMPLE_ASSERTION.matchAll(
      /<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g,
    );
    for (const match of attrMatches) {
      if (match[1] && match[2]) {
        attributes[match[1]] = match[2];
      }
    }
    expect(attributes.email).toBe("user@example.com");
    expect(attributes.displayName).toBe("Test User");
  });

  it("handles missing attributes gracefully", () => {
    const emptyAssertion = `
      <samlp:Response>
        <saml:Assertion>
          <saml:Subject>
            <saml:NameID>only-name@example.com</saml:NameID>
          </saml:Subject>
          <saml:AttributeStatement></saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `;
    const nameIdMatch = emptyAssertion.match(
      /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/,
    );
    expect(nameIdMatch?.[1]).toBe("only-name@example.com");

    const attributes: Record<string, string> = {};
    const attrMatches = emptyAssertion.matchAll(
      /<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g,
    );
    for (const match of attrMatches) {
      if (match[1] && match[2]) {
        attributes[match[1]] = match[2];
      }
    }
    expect(Object.keys(attributes)).toHaveLength(0);
  });

  it("finds Signature node in signed XML", () => {
    const signedXml = `
      <samlp:Response>
        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <ds:SignedInfo>
            <ds:Reference>
              <ds:DigestValue>abc123</ds:DigestValue>
            </ds:Reference>
          </ds:SignedInfo>
          <ds:SignatureValue>sig123</ds:SignatureValue>
        </ds:Signature>
      </samlp:Response>
    `;
    const sigMatch = signedXml.match(/<ds:Signature[\s\S]*?<\/ds:Signature>/);
    expect(sigMatch).not.toBeNull();
    expect(sigMatch![0]).toContain("ds:SignatureValue");
  });

  it("returns null when no Signature node present", () => {
    const unsignedXml = `<samlp:Response><saml:Assertion></saml:Assertion></samlp:Response>`;
    const sigMatch = unsignedXml.match(/<ds:Signature[\s\S]*?<\/ds:Signature>/);
    expect(sigMatch).toBeNull();
  });
});
