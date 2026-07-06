import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "del", "a", "ul", "ol", "li",
  "code", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "table", "thead", "tbody", "tr", "th", "td", "img",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "target"];

export function renderMarkdown(md: string): string {
  const { marked } = require("marked");
  const raw = marked.parse(md, { async: false }) as string;
  try {
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
    });
  } catch {
    // Fallback: strip script tags manually if DOMPurify fails in Node.js
    return raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "");
  }
}
