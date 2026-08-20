import { test, expect } from "@playwright/test";

// The suite blocks service workers (see playwright.config.ts) so API traffic
// is never served from SW caches; this spec is the one place the SW must run.
test.use({ serviceWorkers: "allow" });

test.describe("service worker (PWA)", () => {
  test("registers, installs, and activates without evaluation errors", async ({ page }) => {
    // Regression guard: if sw.js throws during script evaluation (e.g. Serwist's
    // add-to-cache-list-conflicting-entries for a duplicated offline.html
    // precache entry), the browser aborts registration and keeps any
    // previously installed SW — which serves stale precached JS after a
    // rebuild. The page error below is how that failure surfaces.
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/login", { waitUntil: "networkidle" });

    // The register() helper runs on window "load"; give it time to settle.
    await page.waitForTimeout(2000);

    const state = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { registrations: "no-serviceWorker" as const };
      const regs = await navigator.serviceWorker.getRegistrations();
      const active = regs[0]?.active?.state ?? null;
      // navigator.serviceWorker.ready resolves once an active worker controls
      // the scope — install + activate both succeeded.
      let ready = false;
      try {
        await navigator.serviceWorker.ready;
        ready = true;
      } catch {
        ready = false;
      }
      return { registrations: regs.length, active, ready };
    });

    expect(pageErrors).toEqual([]);
    expect(state.registrations).toBeGreaterThan(0);
    expect(state.active).toBe("activated");
    expect(state.ready).toBe(true);
  });

  test("reloads the page once when a new build's service worker takes control", async ({
    page,
  }) => {
    // Track how many times the page has loaded. sessionStorage survives
    // reloads (window state does not), and addInitScript re-runs on every
    // navigation, so this counts each load of the tab.
    await page.addInitScript(() => {
      const n = Number(sessionStorage.getItem("pwa-load-count") ?? "0") + 1;
      sessionStorage.setItem("pwa-load-count", String(n));
      (window as unknown as { __pwaLoads: number }).__pwaLoads = n;
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Reading the counter can land in a destroyed execution context while the
    // reload is in flight; return a sentinel so the poll keeps retrying.
    const loads = async () => {
      try {
        return await page.evaluate(() => (window as unknown as { __pwaLoads: number }).__pwaLoads);
      } catch {
        return -1;
      }
    };

    // First visit: the SW registers, installs, and claims (clientsClaim), so a
    // controller appears — but register.tsx intentionally does NOT reload here,
    // because there was no controller when the page mounted.
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller != null, null, {
      timeout: 15000,
    });
    await expect.poll(loads).toBe(1);

    // Reload so the page mounts with an existing controller — the condition
    // under which register.tsx attaches its controllerchange → reload handler
    // (the "a freshly deployed build took control" UX).
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller != null, null, {
      timeout: 15000,
    });
    await expect.poll(loads).toBe(2);

    // Playwright cannot route service worker script fetches, so a byte-different
    // sw.js can't be injected. Instead, drive the exact signal a real SW update
    // produces: with skipWaiting, an updated worker fires `controllerchange`
    // when it takes control. register.tsx's listener should reload exactly once.
    // Defer the dispatch one tick so the evaluate resolves before the reload
    // (which destroys the execution context mid-evaluate otherwise).
    await page.evaluate(() => {
      setTimeout(() => {
        navigator.serviceWorker.dispatchEvent(new Event("controllerchange"));
      }, 0);
    });

    await expect.poll(loads).toBe(3);
    // The one-shot `reloading` guard in register.tsx prevents a reload loop.
    await page.waitForTimeout(1500);
    expect(await loads()).toBe(3);

    // The (real) worker is still active and controlling the page.
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        active: reg?.active?.state ?? null,
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      };
    });
    expect(state.active).toBe("activated");
    expect(state.controller).toContain("/sw.js");
    expect(pageErrors).toEqual([]);
  });
});
