"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { cn } from "@/lib/cn";
import type { ActivityEvent } from "@/lib/activity/types";

type ActivityTimelineProps = {
  events: ActivityEvent[];
  onLoadMore?: () => void;
  hasMore?: boolean;
};

function getActionIcon(action: string): string {
  if (action.includes("created")) return "M12 4v16m8-8H4";
  if (action.includes("updated") || action.includes("changed")) return "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z";
  if (action.includes("deleted") || action.includes("removed")) return "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16";
  if (action.includes("login")) return "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z";
  if (action.includes("comment")) return "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 5.582 9 8z";
  return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
}

function getActionColor(action: string): string {
  if (action.includes("created")) return "bg-success text-success";
  if (action.includes("updated") || action.includes("changed")) return "bg-info text-info";
  if (action.includes("deleted") || action.includes("removed")) return "bg-danger text-danger";
  return "bg-bg-surface-2 text-fg-muted";
}

function DiffView({ before, after }: { before?: unknown; after?: unknown }) {
  const t = useTranslations("audit.diff");
  const locale = useLocale();
  const isRtl = locale === "fa-IR";

  const beforeObj = (before && typeof before === "object" ? before : null) as Record<string, unknown> | null;
  const afterObj = (after && typeof after === "object" ? after : null) as Record<string, unknown> | null;

  if (!beforeObj && !afterObj) {
    return <p className="text-xs text-fg-subtle italic">{t("noChanges")}</p>;
  }

  const allKeys = [...new Set([...Object.keys(beforeObj ?? {}), ...Object.keys(afterObj ?? {})])];

  if (allKeys.length === 0) {
    return <p className="text-xs text-fg-subtle italic">{t("noChanges")}</p>;
  }

  return (
    <div className="space-y-1">
      {allKeys.map((key) => {
        const bVal = beforeObj?.[key];
        const aVal = afterObj?.[key];
        if (bVal === aVal) return null;
        const bStr = bVal === undefined ? "—" : typeof bVal === "object" ? JSON.stringify(bVal) : String(bVal);
        const aStr = aVal === undefined ? "—" : typeof aVal === "object" ? JSON.stringify(aVal) : String(aVal);
        return (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="font-medium text-fg-muted shrink-0 w-24 truncate">{key}</span>
            {isRtl ? (
              <>
                <span className="text-fg-primary truncate max-w-[40%]">{aStr.length > 80 ? aStr.slice(0, 80) + "…" : aStr}</span>
                <span className="text-fg-subtle">{"\u2190"}</span>
                <span className="text-fg-muted truncate max-w-[40%]">{bStr.length > 80 ? bStr.slice(0, 80) + "…" : bStr}</span>
              </>
            ) : (
              <>
                <span className="text-fg-muted truncate max-w-[40%]">{bStr.length > 80 ? bStr.slice(0, 80) + "…" : bStr}</span>
                <span className="text-fg-subtle">{"\u2192"}</span>
                <span className="text-fg-primary truncate max-w-[40%]">{aStr.length > 80 ? aStr.slice(0, 80) + "…" : aStr}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ActivityTimeline({ events, onLoadMore, hasMore }: ActivityTimelineProps) {
  const t = useTranslations();
  const { dateTime } = useFormattedDate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return <p className="text-sm text-fg-muted py-4">{t("audit.empty")}</p>;
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id} className="relative flex gap-4 pb-4">
          {/* Timeline line */}
          {i < events.length - 1 && (
            <div className="absolute start-[11px] top-6 bottom-0 w-px bg-border-primary" />
          )}

          {/* Icon */}
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
            getActionColor(event.type === "audit" ? event.action : "comment_created"),
          )}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getActionIcon(event.type === "audit" ? event.action : "comment_created")} />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-fg-primary">
                {event.type === "audit" ? event.actorName : event.authorName}
              </span>
              <span className="text-sm text-fg-muted">
                {event.type === "audit"
                  ? t(`audit.actions.${event.action}` as never)
                  : t("common.commented")}
              </span>
              {event.type === "comment" && (
                <span className="text-sm text-fg-muted">{t("common.onThisTask")}</span>
              )}
            </div>

            {event.type === "comment" && (
              <p
                className="text-sm text-fg-muted mt-1 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: event.body }}
              />
            )}

            {event.type === "audit" && event.details && (
              <button
                onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                className="text-xs text-accent hover:underline mt-1"
              >
                {expandedId === event.id ? t("common.hideDetails") : t("common.showDetails")}
              </button>
            )}

            {event.type === "audit" && expandedId === event.id && event.details && (
              <div className="mt-2 p-3 bg-bg-surface rounded-lg border border-border-secondary">
                <DiffView before={event.details.before} after={event.details.after} />
              </div>
            )}

            <p className="text-xs text-fg-subtle mt-1">{dateTime(event.createdAt)}</p>
          </div>
        </div>
      ))}

      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="w-full text-sm text-accent hover:underline py-2 text-center"
        >
          {t("common.loadMore")}
        </button>
      )}
    </div>
  );
}
