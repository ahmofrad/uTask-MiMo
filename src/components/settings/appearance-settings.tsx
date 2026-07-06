"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "@/components/theme/provider";

export function AppearanceSettings() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { theme, setTheme, accent, setAccent } = useTheme();

  const accentColors = [
    { name: "Blue", value: "blue" as const, color: "#2563eb" },
    { name: "Green", value: "green" as const, color: "#16a34a" },
    { name: "Purple", value: "purple" as const, color: "#9333ea" },
    { name: "Orange", value: "orange" as const, color: "#ea580c" },
    { name: "Red", value: "red" as const, color: "#dc2626" },
    { name: "Teal", value: "teal" as const, color: "#0d9488" },
    { name: "Pink", value: "pink" as const, color: "#db2777" },
    { name: "Indigo", value: "indigo" as const, color: "#4f46e5" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-fg-secondary mb-3">{t("theme")}</h3>
        <div className="flex gap-3">
          {(["light", "dark", "system"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTheme(mode)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                theme === mode
                  ? "border-accent bg-accent-bg text-accent"
                  : "border-border-primary text-fg-secondary hover:bg-bg-surface"
              }`}
            >
              {mode === "light" ? t("lightMode") : mode === "dark" ? t("darkMode") : t("systemMode")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-fg-secondary mb-3">{tc("accentColor")}</h3>
        <div className="flex gap-2">
          {accentColors.map((c) => (
            <button
              key={c.value}
              onClick={() => setAccent(c.value)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                accent === c.value ? "border-fg-primary scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c.color }}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
