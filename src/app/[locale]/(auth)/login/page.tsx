import { getSettings } from "@/lib/settings";
import { getEnabledLdapSources } from "@/lib/auth/ldap-sources";
import { LoginPageClient } from "./login-page-client";

export default async function LoginPage() {
  const allSettings = (await getSettings("install", null).catch(() => ({}))) as Record<string, unknown>;

  const saml = (allSettings.saml ?? {}) as Record<string, unknown>;

  const enabledSources = await getEnabledLdapSources();
  const ldapSources = enabledSources.map((source) => ({
    id: source.id,
    name: source.name,
  }));
  const ssoConfigured = Boolean(saml.enabled && saml.ssoUrl);

  return (
    <LoginPageClient
      ldapSources={ldapSources}
      ssoConfigured={ssoConfigured}
    />
  );
}
