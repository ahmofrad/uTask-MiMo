type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${[r, g, b]
    .map((c) => clamp(c * (1 - amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function readableOn(hex: string): string {
  const bg = relativeLuminance(hexToRgb(hex));
  const white = relativeLuminance(hexToRgb("#ffffff"));
  const black = relativeLuminance(hexToRgb("#18181b"));
  const whiteContrast = (white + 0.05) / (bg + 0.05);
  const blackContrast = (bg + 0.05) / (black + 0.05);
  return whiteContrast >= blackContrast ? "#ffffff" : "#18181b";
}

/**
 * Build the full accent CSS-variable set for a base hue. `accent-bg` and
 * `accent-ring` are alpha tints so they read correctly in both light and dark
 * themes without needing a separate per-theme override.
 */
export function buildAccentVars(base: string): Record<string, string> {
  return {
    "--accent": base,
    "--accent-fg": readableOn(base),
    "--accent-hover": darken(base, 0.12),
    "--accent-bg": rgba(base, 0.14),
    "--accent-ring": rgba(base, 0.45),
  };
}
