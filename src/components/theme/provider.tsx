"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buildAccentVars, lighten } from "@/lib/theme/color";

export type Theme = "light" | "dark" | "system";
export type Accent = "blue" | "green" | "purple" | "orange" | "red" | "teal" | "pink" | "indigo";

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

const ACCENT_COLORS: Record<Accent, string> = {
  blue: "#2563eb",
  green: "#16a34a",
  purple: "#9333ea",
  orange: "#ea580c",
  red: "#dc2626",
  teal: "#0d9488",
  pink: "#db2777",
  indigo: "#4f46e5",
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
      theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const isDark =
      theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
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
