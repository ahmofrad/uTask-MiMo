"use client";

import { useEffect } from "react";

/**
 * Registers the Serwist service worker. Only in production builds — the SW is
 * not generated in `next dev`, so registering there would 404.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // When an updated SW (new build) takes control of this page, reload once so
    // the tab stops running old chunks and picks up the new precache. Only
    // reload when a controller already existed: on first install there is no
    // controller yet, so clients.claim() would otherwise cause a needless
    // reload on the very first visit.
    if (navigator.serviceWorker.controller) {
      let reloading = false;
      const onControllerChange = () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          // Check for a new build immediately after registering and whenever
          // the tab becomes visible again. Browsers only poll for SW updates
          // every ~24h on their own, so without this a freshly deployed
          // rebuild can keep serving stale precached JS for a whole day.
          void registration.update().catch(() => {});
          const checkForUpdates = () => {
            if (document.visibilityState === "visible") {
              void registration.update().catch(() => {});
            }
          };
          document.addEventListener("visibilitychange", checkForUpdates);
        })
        .catch(() => {
          // Registration failures are non-fatal; the app still works online.
        });
    };

    window.addEventListener("load", register);
  }, []);

  return null;
}
