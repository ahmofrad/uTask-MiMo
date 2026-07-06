import { marked } from "marked";

const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const JAVASCRIPT_URL_REGEX = /href\s*=\s*"javascript:/gi;

function sanitize(html: string): string {
  return html
    .replace(SCRIPT_REGEX, "")
    .replace(EVENT_HANDLER_REGEX, "")
    .replace(JAVASCRIPT_URL_REGEX, 'href="');
}

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md) as string;
  return sanitize(raw);
}
