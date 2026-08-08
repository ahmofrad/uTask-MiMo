import { describe, it, expect } from "vitest";
import { renderMarkdown, sanitizeHtml } from "@/lib/markdown/render";

describe("renderMarkdown", () => {
  it("converts markdown to HTML", () => {
    const result = renderMarkdown("**bold** and *italic*");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("strips script tags (XSS protection)", () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("strips onerror attributes", () => {
    const result = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });

  it("strips unquoted event-handler attributes", () => {
    const result = renderMarkdown("<img src=x onerror=alert(1)>");
    expect(result).not.toContain("onerror");
  });

  it("rejects encoded javascript URLs", () => {
    const result = renderMarkdown("[x](java&#x73;cript:alert(1))");
    expect(result).not.toMatch(/javascript:/i);
    expect(result).not.toContain("java&#x73;cript");
  });

  it("removes unsafe inline styles and SVG content", () => {
    const result = sanitizeHtml(
      '<div style="background:url(javascript:alert(1))"><svg><script>alert(1)</script></svg></div>',
    );
    expect(result).not.toMatch(/javascript:|<svg|<script|style=/i);
  });

  it("allows links", () => {
    const result = renderMarkdown("[link](https://example.com)");
    expect(result).toContain("<a");
    expect(result).toContain("https://example.com");
  });

  it("renders code blocks", () => {
    const result = renderMarkdown("```\ncode\n```");
    expect(result).toContain("<code>");
  });

  it("renders lists", () => {
    const result = renderMarkdown("- item 1\n- item 2");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
  });
});
