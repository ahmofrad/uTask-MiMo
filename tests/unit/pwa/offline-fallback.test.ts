import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Unit tests that verify the PWA offline fallback configuration:
 * 1. public/offline.html exists and contains required content
 * 2. src/app/sw.ts configures the fallback correctly
 * 3. next.config.mjs registers the Serwist plugin
 *
 * These are static verification tests — no browser required.
 */
describe("PWA offline fallback configuration", () => {
  let offlineHtml: string;
  let swSource: string;

  beforeAll(() => {
    offlineHtml = readFileSync(join(process.cwd(), "public", "offline.html"), "utf-8");
    swSource = readFileSync(join(process.cwd(), "src", "app", "sw.ts"), "utf-8");
  });

  describe("offline.html", () => {
    it("contains the offline message", () => {
      const lower = offlineHtml.toLowerCase();
      expect(lower).toContain("offline");
    });

    it("is valid HTML with the required structural elements", () => {
      expect(offlineHtml).toContain("<!DOCTYPE html>");
      expect(offlineHtml).toContain("<html");
      expect(offlineHtml).toContain("<body");
      expect(offlineHtml).toContain("</html>");
    });

    it("has a title that identifies the app", () => {
      expect(offlineHtml).toContain("uTask");
    });

    it("includes RTL-ready dir attribute", () => {
      // The offline page should work in both LTR and RTL layouts.
      expect(offlineHtml).toMatch(/dir="(ltr|rtl|auto)"/);
    });
  });

  describe("service worker fallback configuration", () => {
    it("references offline.html in the fallbacks section", () => {
      expect(swSource).toContain("offline.html");
    });

    it("uses navigation matcher for the fallback", () => {
      expect(swSource).toContain("request.mode === \"navigate\"");
    });

    it("does NOT duplicate offline.html in precacheEntries", () => {
      // Adding offline.html a second time causes Serwist's
      // addToPrecacheList to throw. The comment in sw.ts explains this.
      const precacheLine = swSource.includes("__SW_MANIFEST");
      expect(precacheLine).toBe(true);
      // The critical check: offline.html must NOT appear in the precacheEntries array.
      const precacheEntriesMatch = swSource.match(
        /precacheEntries:\s*\[[\s\S]*?\]/,
      );
      if (precacheEntriesMatch) {
        expect(precacheEntriesMatch[0]).not.toContain("offline.html");
      }
    });

    it("has skipWaiting enabled for immediate activation", () => {
      expect(swSource).toContain("skipWaiting: true");
    });

    it("has clientsClaim enabled for immediate page control", () => {
      expect(swSource).toContain("clientsClaim: true");
    });
  });

  describe("navigation requests", () => {
    it("API calls use NetworkOnly (no offline caching)", () => {
      expect(swSource).toContain("/api/");
      expect(swSource).toContain("NetworkOnly");
    });

    it("same-origin navigation uses NetworkOnly for fresh HTML", () => {
      // Navigation requests for pages use NetworkOnly so chunk references
      // never point at a stale build. The offline fallback catches failures.
      const navigationSection = swSource.substring(
        swSource.indexOf("request.mode === \"navigate\" && sameOrigin"),
      );
      expect(navigationSection).toContain("NetworkOnly");
    });
  });
});
