"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export function SignOutButton() {
  const t = useTranslations("common");

  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full text-start px-4 py-2 text-sm text-fg-secondary hover:text-destructive hover:bg-bg-surface-2 rounded-lg transition-colors"
    >
      {t("signOut")}
    </button>
  );
}
