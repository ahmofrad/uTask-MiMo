import { describe, expect, it } from "vitest";
import { getLogoutRedirectUrl } from "@/lib/auth/logout-redirect";

describe("getLogoutRedirectUrl", () => {
  it("keeps the current host when building the login URL", () => {
    expect(getLogoutRedirectUrl("http://172.31.252.14:3000")).toBe("http://172.31.252.14:3000/login");
  });

  it("supports HTTPS origins", () => {
    expect(getLogoutRedirectUrl("https://tasks.example.test")).toBe("https://tasks.example.test/login");
  });
});
