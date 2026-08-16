import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

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
const swPath = join(PUBLIC, "sw.js");
if (!existsSync(swPath)) {
  fail("public/sw.js is missing (run `pnpm build` to generate it)");
}

// Evaluate the service worker in a mocked worker scope. Serwist throws during
// script evaluation on duplicate precache entries (e.g. offline.html added
// both by the manifest and manually), which makes browsers fail registration
// entirely and keep serving stale precached JS from a previous build. Catching
// that here keeps the check fast and deterministic without a browser.
const swSource = readFileSync(swPath, "utf8");
const swSelf = {
  location: { origin: "http://localhost:3000", href: "http://localhost:3000/" },
  navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
  registration: { scope: "http://localhost:3000/" },
  addEventListener: () => undefined,
  skipWaiting: () => undefined,
  clientsClaim: () => undefined,
  caches: { keys: async () => [], open: async () => ({}), match: async () => null },
  fetch: () => Promise.reject(new Error("no network in pwa:check")),
  __SW_MANIFEST: [],
};
(swSelf as Record<string, unknown>).self = swSelf;
try {
  vm.runInNewContext(swSource, {
    self: swSelf,
    console,
    URL,
    Request,
    Response,
    Headers,
    Blob,
    Date,
    Math,
    Promise,
    Set,
    Map,
    WeakSet,
    WeakMap,
    setTimeout,
    clearTimeout,
    navigator: swSelf.navigator,
    location: swSelf.location,
    registration: swSelf.registration,
  } as never, { filename: "sw.js" });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`public/sw.js failed to evaluate: ${message}`);
}

console.log("✓ pwa:check passed");
