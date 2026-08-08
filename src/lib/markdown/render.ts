import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|(?:\/|#|\.{0,2}\/)|[a-z0-9][^:]*$)/i;

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "a",
    "blockquote",
    "br",
    "code",
    "del",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "ul",
  ],
  ALLOWED_ATTR: ["class", "colspan", "href", "rel", "rowspan", "start", "target", "title"],
  ALLOWED_URI_REGEXP,
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["base", "embed", "form", "iframe", "link", "meta", "object", "script", "style", "svg"],
  FORBID_ATTR: ["style"],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md) as string;
  return sanitizeHtml(raw);
}
