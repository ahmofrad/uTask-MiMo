"use client";

import { useLocale, useTranslations } from "next-intl";

const LOCALES = [
  { value: "fa-IR", label: "فارسی" },
  { value: "en-US", label: "English" },
] as const;

function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()};SameSite=Lax`;
}

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("settings");

  function switchLocale(newLocale: string) {
    setCookie("NEXT_LOCALE", newLocale, 365);
    const pathname = window.location.pathname;
    const restPath = pathname.startsWith("/en-US") ? pathname.slice(6) || "/" : pathname;
    const newPath = newLocale === "en-US" ? `/en-US${restPath}` : restPath || "/";
    window.location.href = newPath;
  }

  return (
    <select
      value={locale}
      onChange={(e) => switchLocale(e.target.value)}
      className="text-sm bg-bg-surface border border-border-primary rounded-md px-2 py-1 text-fg-secondary focus:outline-none focus:ring-1 focus:ring-accent"
      aria-label={t("language")}
    >
      {LOCALES.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
