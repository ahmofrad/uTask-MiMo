"use client";

import { LoginForm } from "@/components/auth/login-form";
import { LocaleSwitcher } from "@/components/locale/switcher";
import { Logo } from "@/components/brand/logo";
import { useTranslations } from "next-intl";

type LoginPageClientProps = {
  ldapConfigured: boolean;
  ssoConfigured: boolean;
  ldapDomain: string;
};

export function LoginPageClient({ ldapConfigured, ssoConfigured, ldapDomain }: LoginPageClientProps) {
  const t = useTranslations("auth.login");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-bg-app to-bg-surface px-4 relative">
      <div className="absolute top-4 start-4">
        <LocaleSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size={40} showWordmark />
        </div>

        <div className="bg-bg-surface rounded-2xl shadow-lg border border-border p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-fg">{t("title")}</h1>
            <p className="text-sm text-fg-muted mt-1">{t("welcomeBack")}</p>
          </div>
          <LoginForm ldapConfigured={ldapConfigured} ssoConfigured={ssoConfigured} ldapDomain={ldapDomain} />
        </div>

        <p className="text-center text-xs text-fg-muted mt-6">{t("footer")}</p>
      </div>
    </main>
  );
}
