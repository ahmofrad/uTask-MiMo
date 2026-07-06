import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/markdown/render";

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
