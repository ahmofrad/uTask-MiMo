import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = "public";

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface Manifest {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
}

function fail(message: string): never {
  console.error(`✗ pwa:check failed: ${message}`);
  process.exit(1);
}

const manifestPath = join(PUBLIC, "manifest.webmanifest");
if (!existsSync(manifestPath)) fail("public/manifest.webmanifest is missing");

let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
} catch {
  fail("public/manifest.webmanifest is not valid JSON");
}

for (const field of ["name", "short_name", "start_url", "scope", "display", "theme_color", "background_color"] as const) {
  if (!manifest[field]) fail(`manifest is missing required field "${field}"`);
}

if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  fail("manifest has no icons");
}

// Icons that must exist on disk.
const requiredIconFiles = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

for (const icon of requiredIconFiles) {
  if (!existsSync(join(PUBLIC, icon))) fail(`missing PWA icon file: ${icon}`);
}

// Icons that must also be referenced from the manifest (apple-touch-icon is
// provided via the HTML <link>, not the manifest).
const manifestRequiredIcons = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

const manifestIconSrcs = new Set(manifest.icons.map((i) => i.src));
for (const icon of manifestRequiredIcons) {
  if (!manifestIconSrcs.has(icon)) fail(`manifest does not reference icon: ${icon}`);
}

if (!existsSync(join(PUBLIC, "offline.html"))) fail("public/offline.html is missing");
if (!existsSync(join(PUBLIC, "sw.js"))) {
  console.warn("⚠ pwa:check: public/sw.js not found (run `pnpm build` to generate it)");
}

console.log("✓ pwa:check passed");
