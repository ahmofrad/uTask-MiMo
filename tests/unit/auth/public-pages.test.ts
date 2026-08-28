import { describe, it, expect } from "vitest";
import { isPublicAuthPage } from "@/lib/auth/public-pages";

describe("isPublicAuthPage", () => {
  it("matches forgot-password paths", () => {
    expect(isPublicAuthPage("/forgot-password")).toBe(true);
    expect(isPublicAuthPage("/en-US/forgot-password")).toBe(true);
    expect(isPublicAuthPage("/fa-IR/forgot-password")).toBe(true);
  });

  it("matches reset-password paths with token", () => {
    expect(isPublicAuthPage("/reset-password/abc123")).toBe(true);
    expect(isPublicAuthPage("/en-US/reset-password/abc123")).toBe(true);
    expect(isPublicAuthPage("/fa-IR/reset-password/abc123")).toBe(true);
  });

  it("matches invite paths with token", () => {
    expect(isPublicAuthPage("/invite/abc123")).toBe(true);
    expect(isPublicAuthPage("/en-US/invite/abc123")).toBe(true);
    expect(isPublicAuthPage("/fa-IR/invite/abc123")).toBe(true);
  });

  it("does not match other paths", () => {
    expect(isPublicAuthPage("/login")).toBe(false);
    expect(isPublicAuthPage("/projects")).toBe(false);
    expect(isPublicAuthPage("/")).toBe(false);
    expect(isPublicAuthPage("/settings")).toBe(false);
  });

  it("does not match partial prefix paths", () => {
    expect(isPublicAuthPage("/invite")).toBe(false);
    expect(isPublicAuthPage("/reset-password")).toBe(false);
    expect(isPublicAuthPage("/forgot-password/extra")).toBe(false);
  });

  it("handles edge cases", () => {
    expect(isPublicAuthPage("")).toBe(false);
    expect(isPublicAuthPage("/")).toBe(false);
    expect(isPublicAuthPage("/invite/")).toBe(true);
    expect(isPublicAuthPage("/en-US/invite/")).toBe(true);
  });
});
