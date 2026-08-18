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
});
