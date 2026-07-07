import { marked } from "marked";

const FULL_SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const BLOCKED_OPEN_TAGS = /<(?:iframe|object|embed|form|meta|link|style|base)\b[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const JAVASCRIPT_URL_REGEX = /(?:(?:href|src|action)\s*=\s*(?:"javascript:|'javascript:|data:text\/html))/gi;
const CSS_EXPRESSION_REGEX = /expression\s*\(/gi;

function sanitize(html: string): string {
  return html
    .replace(FULL_SCRIPT_REGEX, "")
    .replace(BLOCKED_OPEN_TAGS, "")
    .replace(EVENT_HANDLER_REGEX, "")
    .replace(JAVASCRIPT_URL_REGEX, (match) => {
      return match.replace(/javascript:|data:text\/html/gi, "");
    })
    .replace(CSS_EXPRESSION_REGEX, "(");
}

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md) as string;
  return sanitize(raw);
}
