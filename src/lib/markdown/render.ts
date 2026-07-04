import DOMPurify from "isomorphic-dompurify";

export function renderMarkdown(md: string): string {
  const { marked } = require("marked");
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "del", "a", "ul", "ol", "li",
      "code", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
      "hr", "table", "thead", "tbody", "tr", "th", "td", "img",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target"],
  });
}
