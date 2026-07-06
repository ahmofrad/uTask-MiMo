import { getSettings } from "@/lib/settings";
import { LoginPageClient } from "./login-page-client";

export default async function LoginPage() {
  const ldap = (await getSettings("install", "ldap").catch(() => ({}))) as Record<string, unknown>;
  const saml = (await getSettings("install", "saml").catch(() => ({}))) as Record<string, unknown>;

  const ldapConfigured = Boolean(ldap.enabled && ldap.serverUrl);
  const ssoConfigured = Boolean(saml.enabled && saml.ssoUrl);
  const ldapDomain = String(ldap.domain || "LDAP");

  return (
    <LoginPageClient
      ldapConfigured={ldapConfigured}
      ssoConfigured={ssoConfigured}
      ldapDomain={ldapDomain}
    />
  );
}
