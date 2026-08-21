"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type Props = { userId: string };

export function LanguageSettings({ userId }: Props) {
  const t = useTranslations("settings");
  const currentLocale = useLocale();

  async function switchLocale(locale: string) {
    await apiFetch(`/api/v1/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: locale.replace("-", "_") }),
    }).catch(() => {});
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-fg-secondary mb-3">{t("language")}</h3>
        <div className="space-y-2">
          {[
            { code: "fa-IR", label: "فارسی (Persian)" },
            { code: "en-US", label: "English" },
          ].map((lang) => (
            <label key={lang.code} className="flex items-center gap-2 text-sm text-fg-primary cursor-pointer">
              <input
                type="radio"
                name="locale"
                checked={currentLocale === lang.code}
                onChange={() => switchLocale(lang.code)}
                className="accent-accent"
              />
              {lang.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-fg-secondary mb-3">{t("calendar")}</h3>
        <div className="space-y-2">
          {[
            { key: "jalali", label: t("jalali") },
            { key: "gregorian", label: t("gregorian") },
          ].map((cal) => (
            <label key={cal.key} className="flex items-center gap-2 text-sm text-fg-primary">
              <input
                type="radio"
                name="calendar"
                defaultChecked={cal.key === "jalali" && currentLocale === "fa-IR"}
                className="accent-accent"
              />
              {cal.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
