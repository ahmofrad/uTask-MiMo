import { describe, expect, it } from "vitest";
import { isPublicAuthPage } from "@/lib/auth/public-pages";

describe("public authentication pages", () => {
  it.each([
    "/forgot-password",
    "/en-US/forgot-password",
    "/fa-IR/forgot-password",
    "/reset-password/0123456789abcdef",
    "/en-US/reset-password/0123456789abcdef",
    "/fa-IR/reset-password/0123456789abcdef",
    "/invite/0123456789abcdef",
    "/en-US/invite/0123456789abcdef",
    "/fa-IR/invite/0123456789abcdef",
  ])("allows unauthenticated access to %s", (pathname) => {
    expect(isPublicAuthPage(pathname)).toBe(true);
  });

  it.each(["/dashboard", "/en-US/settings", "/en-US/admin"]) (
    "keeps %s protected",
    (pathname) => {
      expect(isPublicAuthPage(pathname)).toBe(false);
    },
  );
});
