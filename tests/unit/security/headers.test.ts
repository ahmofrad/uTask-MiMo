import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: class MockNextResponse {
    headers = new Map<string, string>();
    set(key: string, value: string) {
      this.headers.set(key, value);
    }
    get(key: string) {
      return this.headers.get(key);
    }
  },
}));

import { applySecurityHeaders } from "@/lib/security/headers";
import { NextResponse } from "next/server";

describe("applySecurityHeaders", () => {
  it("adds Content-Security-Policy header", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("adds Strict-Transport-Security header", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("adds X-Content-Type-Options header", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("adds X-Frame-Options header", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("adds Referrer-Policy header", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("adds Permissions-Policy header", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    const policy = response.headers.get("Permissions-Policy");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("returns the response object", () => {
    const response = new NextResponse();
    const result = applySecurityHeaders(response as never);
    expect(result).toBe(response);
  });

  it("CSP includes frame-ancestors none", () => {
    const response = new NextResponse();
    applySecurityHeaders(response as never);
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
