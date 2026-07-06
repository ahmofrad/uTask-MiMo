import { LoginForm } from "@/components/auth/login-form";
import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/settings";
import { LocaleSwitcher } from "@/components/locale/switcher";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  const ldap = (await getSettings("install", "ldap").catch(() => ({}))) as Record<string, unknown>;
  const saml = (await getSettings("install", "saml").catch(() => ({}))) as Record<string, unknown>;

  const ldapConfigured = Boolean(ldap.enabled && ldap.serverUrl);
  const ssoConfigured = Boolean(saml.enabled && saml.ssoUrl);
  const ldapDomain = String(ldap.domain || "LDAP");

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-app px-4 relative">
      {/* Language picker */}
      <div className="absolute top-4 end-4">
        <LocaleSwitcher />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-fg-primary tracking-tight">uTask</h1>
          <p className="text-sm text-fg-muted mt-1">{t("welcomeBack")}</p>
        </div>

        {/* Card */}
        <div className="bg-bg-surface rounded-2xl shadow-lg border border-border-primary p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-fg-primary">{t("title")}</h2>
          </div>

          <LoginForm
            ldapConfigured={ldapConfigured}
            ssoConfigured={ssoConfigured}
            ldapDomain={ldapDomain}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-fg-muted mt-6">
          {t("footer")}
        </p>
      </div>
    </div>
  );
}
