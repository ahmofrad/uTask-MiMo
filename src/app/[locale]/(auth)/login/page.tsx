import { getSettings } from "@/lib/settings";
import { LoginPageClient } from "./login-page-client";

export default async function LoginPage() {
  const allSettings = (await getSettings("install", null).catch(() => ({}))) as Record<string, unknown>;

  const ldap = (allSettings.ldap ?? {}) as Record<string, unknown>;
  const saml = (allSettings.saml ?? {}) as Record<string, unknown>;

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
