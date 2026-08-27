"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

/**
 * Segment-to-translation-key mapping for known path segments.
 * Unknown segments (e.g. UUIDs) are rendered as-is with truncation.
 */
const SEGMENT_LABELS: Record<string, string> = {
  admin: "nav.admin",
  settings: "nav.settings",
  projects: "nav.projects",
  workspace: "nav.workspace",
  calendar: "nav.calendar",
  tasks: "task.title",
  board: "task.board",
  gantt: "task.gantt",
  members: "project.members.title",
  groups: "nav.groups",
  users: "admin.users",
  webhooks: "admin.webhooks",
  "webhook-deliveries": "admin.webhookDeliveries",
  tokens: "admin.apiTokens",
  backups: "admin.backups",
  health: "admin.health",
  departments: "admin.departments",
  templates: "admin.templates",
  sso: "admin.sso",
  insights: "nav.insights",
  "rate-cards": "admin.rateCards",
  "active-directory": "admin.activeDirectory",
  "ldap-sync": "admin.ldapSync",
  storage: "admin.storage.title",
  inbox: "nav.inbox",
  today: "nav.today",
  upcoming: "nav.upcoming",
  subtasks: "task.subtasks",
  dependencies: "task.dependencies.title",
  "custom-fields": "project.customFields",
  notifications: "nav.notifications",
};

export function Breadcrumbs() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();

  // Strip locale prefix for segment parsing
  const stripped = pathname.replace(/^\/(fa-IR|en-US)/, "") || "/";

  // Skip breadcrumbs on root, login, and auth pages
  if (stripped === "/" || stripped.startsWith("/login")) return null;

  const segments = stripped.split("/").filter(Boolean);

  // Skip breadcrumbs for very shallow routes (dashboard-level)
  if (segments.length <= 1) return null;

  const crumbs: { label: string; href: string }[] = [];
  let accumulated = `/${locale}`;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    accumulated += `/${segment}`;
    // Try translation key first, fall back to formatted segment text
    const translationKey = SEGMENT_LABELS[segment];
    const label = translationKey ? t(translationKey) : formatSegment(segment);

    crumbs.push({
      label,
      href: accumulated,
    });
  }

  return (
    <nav aria-label={t("common.breadcrumbs")} className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-fg-muted">
        {crumbs.map((crumb, i) => {
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-fg-muted/50 select-none" aria-hidden>
                  /
                </span>
              )}
              {i === crumbs.length - 1 ? (
                <span className="text-fg font-medium truncate max-w-[200px]">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-accent transition-colors truncate max-w-[160px]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Format a raw path segment into a human-readable label. */
function formatSegment(segment: string): string {
  // UUIDs: show first 8 chars
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return segment.slice(0, 8) + "…";
  }
  // kebab-case → Title Case
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
