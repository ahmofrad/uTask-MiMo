"use client";

import { useTranslations } from "next-intl";
import { useTheme, ACCENT_COLORS } from "@/components/theme/provider";

export function AppearanceSettings() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { theme, setTheme, accent, setAccent } = useTheme();

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
              onClick={() => setTheme(mode)}
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
              onClick={() => setAccent(c.value)}
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
