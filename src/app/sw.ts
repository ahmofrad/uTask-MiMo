/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

declare global {
  // eslint-disable-next-line no-unused-vars
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const runtimeCaching: RuntimeCaching[] = [
  // API calls are always live (no offline data sync).
  {
    matcher: ({ url }) => url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  // Page navigations: always fetch live HTML so chunk references never
  // point at a stale build. A rebuild replaces every JS/CSS hash, and
  // cached HTML from a previous build causes 404s on those old chunks —
  // the page flickers and Next.js dialog-spams "an error has occurred".
  // Offline fallback is handled by the fallbacks section below.
  {
    matcher: ({ request, sameOrigin }) => request.mode === "navigate" && sameOrigin,
    handler: new NetworkOnly(),
  },
  // Everything else (static assets, fonts, images) uses Serwist defaults.
  ...defaultCache,
];

const serwist = new Serwist({
  // Note: do NOT add public/offline.html here — @serwist/next already includes
  // it in __SW_MANIFEST (with a revision hash). Adding it a second time makes
  // addToPrecacheList throw "add-to-cache-list-conflicting-entries" during
  // script evaluation, which fails SW registration entirely and leaves any
  // previously installed SW serving stale precached JS after a rebuild.
  precacheEntries: [...(self.__SW_MANIFEST ?? [])],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();
