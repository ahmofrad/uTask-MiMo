/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";
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
  // Page navigations: network-first, with a short timeout before using cache.
  {
    matcher: ({ request, sameOrigin }) => request.mode === "navigate" && sameOrigin,
    handler: new NetworkFirst({ networkTimeoutSeconds: 5 }),
  },
  // Everything else (static assets, fonts, images) uses Serwist defaults.
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: [...(self.__SW_MANIFEST ?? []), { url: "/offline.html" }],
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
