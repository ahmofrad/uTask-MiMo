"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buildAccentVars, lighten } from "@/lib/theme/color";

export type Theme = "light" | "dark" | "system" | "midnight" | "solarized" | "high_contrast" | "nord";
export type Accent = "blue" | "green" | "purple" | "orange" | "red" | "teal" | "pink" | "indigo";

const DARK_THEMES = new Set<Theme>(["dark", "midnight", "high_contrast", "nord"]);
const NAMED_THEMES = new Set<Theme>(["midnight", "solarized", "high_contrast", "nord"]);

type ThemeContextType = {
  theme: Theme;
  accent: Accent;
  setTheme: (_t: Theme) => void;
  setAccent: (_a: Accent) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  accent: "blue",
  setTheme: (_t: Theme) => {},
  setAccent: (_a: Accent) => {},
});

// 700/800-level hues so accent text passes 4.5:1 on white and on the
// runtime rgba(base, 0.14) accent-bg tint (AA for small text).
const ACCENT_COLORS: Record<Accent, string> = {
  blue: "#4f46e5",
  green: "#15803d",
  purple: "#7c3aed",
  orange: "#c2410c",
  red: "#b91c1c",
  teal: "#0f766e",
  pink: "#be185d",
  indigo: "#4338ca",
};

export function ThemeProvider({ children, initialTheme, initialAccent }: {
  children: ReactNode;
  initialTheme?: Theme;
  initialAccent?: Accent;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? "system");
  const [accent, setAccentState] = useState<Accent>(initialAccent ?? "blue");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const storedAccent = localStorage.getItem("accent") as Accent | null;
    if (storedTheme) setThemeState(storedTheme);
    if (storedAccent) setAccentState(storedAccent);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const isDark =
      DARK_THEMES.has(theme) ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    // Remove all theme classes first, then add the active one.
    root.classList.remove("light", "dark", ...NAMED_THEMES);
    if (NAMED_THEMES.has(theme)) {
      root.classList.add(theme);
    } else if (theme === "system") {
      root.classList.add(isDark ? "dark" : "light");
    } else {
      root.classList.add(theme);
    }

    root.style.colorScheme = isDark ? "dark" : "light";
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const isDark =
      DARK_THEMES.has(theme) || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    // Lift the accent in dark mode so the hard 600-level hues read softer
    // on dark surfaces (e.g. links, tags, focus rings).
    const base = isDark ? lighten(ACCENT_COLORS[accent], 0.18) : ACCENT_COLORS[accent];
    const vars = buildAccentVars(base);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    localStorage.setItem("accent", accent);
  }, [accent, theme, mounted]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
      document.documentElement.classList.toggle("light", !mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t: Theme) { setThemeState(t); }
  function setAccent(a: Accent) { setAccentState(a); }

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { ACCENT_COLORS };
