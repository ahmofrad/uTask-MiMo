import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";

describe("applySecurityHeaders", () => {
  it("sets Content-Security-Policy", () => {
    const res = applySecurityHeaders(new NextResponse());
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("Content-Security-Policy")).toContain("object-src 'none'");
  });

  it("sets Strict-Transport-Security", () => {
    const res = applySecurityHeaders(new NextResponse());
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    const res = applySecurityHeaders(new NextResponse());
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY", () => {
    const res = applySecurityHeaders(new NextResponse());
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy", () => {
    const res = applySecurityHeaders(new NextResponse());
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy", () => {
    const res = applySecurityHeaders(new NextResponse());
    const pp = res.headers.get("Permissions-Policy");
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  it("does not overwrite existing headers", () => {
    const res = new NextResponse();
    res.headers.set("X-Custom", "existing");
    applySecurityHeaders(res);
    expect(res.headers.get("X-Custom")).toBe("existing");
  });

  it("CSP allows self for scripts in production", () => {
    const res = applySecurityHeaders(new NextResponse());
    const csp = res.headers.get("Content-Security-Policy")!;
    // In test env (NODE_ENV=test), unsafe-eval should NOT be present
    // unless the code checks for development specifically
    expect(csp).toContain("script-src 'self'");
  });
});
