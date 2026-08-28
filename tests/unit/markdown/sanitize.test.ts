import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderMarkdown, sanitizeHtml } from "@/lib/markdown/render";

describe("markdown render / sanitize", () => {
  it("renders basic markdown to HTML", () => {
    const html = renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("strips script tags via DOMPurify", () => {
    const clean = sanitizeHtml('<script>alert("xss")</script><p>safe</p>');
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<p>safe</p>");
  });

  it("strips iframe tags", () => {
    const clean = sanitizeHtml('<iframe src="https://evil.com"></iframe><p>ok</p>');
    expect(clean).not.toContain("<iframe>");
    expect(clean).toContain("<p>ok</p>");
  });

  it("strips onerror handlers from img tags", () => {
    const clean = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(clean).not.toContain("onerror");
  });

  it("allows safe links", () => {
    const html = renderMarkdown("[click](https://example.com)");
    expect(html).toContain("href=\"https://example.com\"");
  });

  it("blocks javascript: URIs", () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain("javascript:");
  });

  it("allows mailto: links", () => {
    const html = renderMarkdown("[email](mailto:test@example.com)");
    expect(html).toContain("mailto:test@example.com");
  });

  it("strips style tags and style attributes", () => {
    const clean = sanitizeHtml('<div style="color:red">red</div><style>.x{}</style>');
    expect(clean).not.toContain("style=");
    expect(clean).not.toContain("<style>");
  });

  it("strips form, embed, object, and base tags", () => {
    const clean = sanitizeHtml("<form><input></form><embed><object><base href=\"evil\">");
    expect(clean).not.toContain("<form>");
    expect(clean).not.toContain("<embed>");
    expect(clean).not.toContain("<object>");
    expect(clean).not.toContain("<base>");
  });

  it("allows table elements", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<td>");
  });

  it("renders code blocks", () => {
    const html = renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("const x = 1;");
  });

  it("allows relative paths in links", () => {
    const html = renderMarkdown("[local](/dashboard)");
    expect(html).toContain("href=\"/dashboard\"");
  });

  it("allows hash links", () => {
    const html = renderMarkdown("[anchor](#section)");
    expect(html).toContain("href=\"#section\"");
  });

  it("does not allow data: URIs", () => {
    const html = renderMarkdown('[click](data:text/html,<script>alert(1)</script>)');
    expect(html).not.toContain("data:");
  });

  it("renders list items", () => {
    const html = renderMarkdown("- item 1\n- item 2");
    expect(html).toContain("<li>");
    expect(html).toContain("item 1");
  });
});
