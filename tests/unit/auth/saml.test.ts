import { describe, it, expect } from "vitest";

// SAML assertion parsing is done by @node-saml/node-saml. We test the
// extraction logic that maps SAML attributes to our user model.

type SamlUser = {
  email: string;
  displayName: string;
  id: string;
};

function extractUserFromSamlProfile(profile: Record<string, unknown>): SamlUser | null {
  const email =
    (profile.email as string | undefined) ??
    (profile["urn:oid:0.9.2342.19200300.100.1.3"] as string | undefined) ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] as string | undefined);

  if (!email) return null;

  const displayName =
    (profile.displayName as string | undefined) ??
    (profile["urn:oid:2.16.840.1.113730.3.1.241"] as string | undefined) ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] as string | undefined) ??
    email;

  const id =
    (profile.nameID as string | undefined) ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] as string | undefined) ??
    email;

  return { email, displayName, id };
}

describe("SAML user extraction", () => {
  it("extracts user from standard OIDC-style profile", () => {
    const user = extractUserFromSamlProfile({
      email: "user@example.com",
      displayName: "Test User",
      nameID: "uid-123",
    });
    expect(user).toEqual({
      email: "user@example.com",
      displayName: "Test User",
      id: "uid-123",
    });
  });

  it("extracts user from LDAP-style OID attributes", () => {
    const user = extractUserFromSamlProfile({
      "urn:oid:0.9.2342.19200300.100.1.3": "ldap@example.com",
      "urn:oid:2.16.840.1.113730.3.1.241": "LDAP User",
    });
    expect(user).toEqual({
      email: "ldap@example.com",
      displayName: "LDAP User",
      id: "ldap@example.com",
    });
  });

  it("extracts user from WS-Federation claims", () => {
    const user = extractUserFromSamlProfile({
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "ws@example.com",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "WS User",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "ws-uid",
    });
    expect(user).toEqual({
      email: "ws@example.com",
      displayName: "WS User",
      id: "ws-uid",
    });
  });

  it("returns null when no email is present", () => {
    const user = extractUserFromSamlProfile({ displayName: "No Email" });
    expect(user).toBeNull();
  });

  it("falls back to email for displayName and id", () => {
    const user = extractUserFromSamlProfile({ email: "fallback@example.com" });
    expect(user?.displayName).toBe("fallback@example.com");
    expect(user?.id).toBe("fallback@example.com");
  });
});
