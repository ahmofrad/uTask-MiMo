import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function SsoLoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg-primary">{t("ssoButton")}</h1>
        <p className="text-sm text-fg-muted mt-2">{t("ssoDescription")}</p>
      </div>

      <div className="space-y-3">
        {/* eslint-disable @next/next/no-html-link-for-pages */}
        <a
          href="/api/v1/auth/ldap/start"
          className="flex items-center gap-3 p-4 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-surface transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-fg-primary">{t("ssoLdap")}</div>
            <div className="text-xs text-fg-muted">{t("ssoLdapDesc")}</div>
          </div>
        </a>

        <a
          href="/api/v1/auth/saml/start"
          className="flex items-center gap-3 p-4 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-surface transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-fg-primary">{t("ssoSaml")}</div>
            <div className="text-xs text-fg-muted">{t("ssoSamlDesc")}</div>
          </div>
        </a>
        {/* eslint-enable @next/next/no-html-link-for-pages */}
      </div>

      <div className="text-center">
        <Link href="/login" className="text-sm text-accent hover:underline">
          {t("ssoBackToLocal")}
        </Link>
      </div>
    </div>
  );
}
