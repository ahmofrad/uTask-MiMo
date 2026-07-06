"use client";

import { LoginForm } from "@/components/auth/login-form";
import { LocaleSwitcher } from "@/components/locale/switcher";
import { useTranslations } from "next-intl";

type LoginPageClientProps = {
  ldapConfigured: boolean;
  ssoConfigured: boolean;
  ldapDomain: string;
};

export function LoginPageClient({ ldapConfigured, ssoConfigured, ldapDomain }: LoginPageClientProps) {
  const t = useTranslations("auth.login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-app px-4 relative">
      <div className="absolute top-4 start-4">
        <LocaleSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-fg-primary tracking-tight">uTask</h1>
          <p className="text-sm text-fg-muted mt-2">{t("welcomeBack")}</p>
        </div>

        <div className="bg-bg-surface rounded-2xl shadow-lg border border-border-primary p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-fg-primary">{t("title")}</h2>
          </div>
          <LoginForm ldapConfigured={ldapConfigured} ssoConfigured={ssoConfigured} ldapDomain={ldapDomain} />
        </div>

        <p className="text-center text-xs text-fg-muted mt-6">{t("footer")}</p>
      </div>
    </div>
  );
}
