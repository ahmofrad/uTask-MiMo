import { describe, expect, it } from "vitest";
import { buildAccentVars, hexToRgb } from "@/lib/theme/color";

type Rgb = ReturnType<typeof hexToRgb>;

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(hexToRgb(first));
  const secondLuminance = relativeLuminance(hexToRgb(second));
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme accent colors", () => {
  it("derives readable foreground colors for every accent preset", () => {
    const accents = [
      "#4f46e5",
      "#15803d",
      "#7c3aed",
      "#c2410c",
      "#b91c1c",
      "#0f766e",
      "#be185d",
      "#4338ca",
    ];

    for (const accent of accents) {
      const vars = buildAccentVars(accent);
      expect(contrastRatio(accent, vars["--accent-fg"] ?? "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });
});
