import { hexToRgb, readableOn } from "./color";

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

/** AA threshold for normal text is 4.5:1, large text 3:1. */
export function passesAa(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? 3 : 4.5);
}

/**
 * Validate an accent base hue for AA compliance: the recommended foreground
 * must read against the accent fill in both light and dark surfaces.
 */
export function accentIsAaCompliant(base: string): boolean {
  const fg = readableOn(base);
  return passesAa(fg, base);
}
