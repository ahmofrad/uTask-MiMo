import { getSettings } from "@/lib/settings";
import { getEnabledLdapSources } from "@/lib/auth/ldap-sources";
import { LoginPageClient } from "./login-page-client";

export default async function LoginPage() {
  const allSettings = (await getSettings("install", null).catch(() => ({}))) as Record<string, unknown>;

  const saml = (allSettings.saml ?? {}) as Record<string, unknown>;

  const enabledSources = await getEnabledLdapSources();
  const ldapConfigured = enabledSources.length > 0;
  const ssoConfigured = Boolean(saml.enabled && saml.ssoUrl);
  const first = enabledSources[0];
  const ldapDomain = first?.name || first?.upnSuffix?.replace(/^@/, "") || "LDAP";

  return (
    <LoginPageClient
      ldapConfigured={ldapConfigured}
      ssoConfigured={ssoConfigured}
      ldapDomain={ldapDomain}
    />
  );
}
