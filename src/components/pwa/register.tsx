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
    let registration: ServiceWorkerRegistration | null = null;
    let checkForUpdates: (() => void) | null = null;
    let reloading = false;
    let disposed = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((nextRegistration) => {
          if (disposed) return;
          registration = nextRegistration;
          // Check for a new build immediately after registering and whenever
          // the tab becomes visible again. Browsers only poll for SW updates
          // every ~24h on their own, so without this a freshly deployed
          // rebuild can keep serving stale precached JS for a whole day.
          void nextRegistration.update().catch(() => {});
          checkForUpdates = () => {
            if (document.visibilityState === "visible") {
              void registration?.update().catch(() => {});
            }
          };
          document.addEventListener("visibilitychange", checkForUpdates);
        })
        .catch(() => {
          // Registration failures are non-fatal; the app still works online.
        });
    };

    window.addEventListener("load", register, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (checkForUpdates) document.removeEventListener("visibilitychange", checkForUpdates);
      registration = null;
    };
  }, []);

  return null;
}
