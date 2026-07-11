import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const ICON_SVG = "src/app/icon.svg";
const OUT_DIR = "public/icons";

// Regular icon: the app's rounded-square SVG (transparent corners are fine).
const regularSvg = readFileSync(ICON_SVG, "utf8");

// Maskable icon: full-bleed square background (no rounded corners) so the
// system mask never clips the artwork. The checkmark stays in the safe zone.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#2563eb"/>
  <path d="M9 16.5l4.5 4.5L23 11" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function render(svg: string, size: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

mkdirSync(OUT_DIR, { recursive: true });

const targets: Array<[string, string, number]> = [
  ["icon-192.png", regularSvg, 192],
  ["icon-512.png", regularSvg, 512],
  ["icon-maskable-192.png", maskableSvg, 192],
  ["icon-maskable-512.png", maskableSvg, 512],
  ["apple-touch-icon.png", regularSvg, 180],
];

for (const [file, svg, size] of targets) {
  writeFileSync(join(OUT_DIR, file), render(svg, size));
  console.log(`wrote ${join(OUT_DIR, file)} (${size}px)`);
}

console.log("PWA icons generated.");
