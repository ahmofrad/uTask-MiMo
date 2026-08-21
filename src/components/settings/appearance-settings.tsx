"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useTheme, ACCENT_COLORS, type Theme, type Accent } from "@/components/theme/provider";
import { apiFetch } from "@/lib/api-fetch";

type Props = { userId: string };

export function AppearanceSettings({ userId }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { theme, setTheme, accent, setAccent } = useTheme();

  const handleSetTheme = useCallback(
    (mode: Theme) => {
      setTheme(mode);
      apiFetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: mode }),
      }).catch(() => {});
    },
    [userId, setTheme],
  );

  const handleSetAccent = useCallback(
    (color: Accent) => {
      setAccent(color);
      apiFetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: color }),
      }).catch(() => {});
    },
    [userId, setAccent],
  );

  const accentColors = [
    { name: tc("accentDefault"), value: "blue" as const },
    { name: tc("accentGreen"), value: "green" as const },
    { name: tc("accentPurple"), value: "purple" as const },
    { name: tc("accentOrange"), value: "orange" as const },
    { name: tc("accentRed"), value: "red" as const },
    { name: tc("accentTeal"), value: "teal" as const },
    { name: tc("accentPink"), value: "pink" as const },
    { name: tc("accentIndigo"), value: "indigo" as const },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-fg-secondary mb-3">{t("theme")}</h3>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system", "midnight", "solarized", "high_contrast", "nord"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleSetTheme(mode)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                theme === mode
                  ? "border-accent bg-accent-bg text-accent"
                  : "border-border-primary text-fg-secondary hover:bg-bg-surface"
              }`}
            >
              {mode === "light" ? t("lightMode") : mode === "dark" ? t("darkMode") : mode === "system" ? t("systemMode") : mode === "midnight" ? t("midnightMode") : mode === "solarized" ? t("solarizedMode") : mode === "high_contrast" ? t("highContrastMode") : t("nordMode")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-fg-secondary mb-3">{tc("accentColor")}</h3>
        <div className="flex flex-wrap gap-2">
          {accentColors.map((c) => (
            <button
              key={c.value}
              onClick={() => handleSetAccent(c.value)}
              className={`w-8 h-8 rounded-full border-2 transition-[transform,border-color] ${
                accent === c.value ? "border-fg-primary scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: ACCENT_COLORS[c.value] }}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
