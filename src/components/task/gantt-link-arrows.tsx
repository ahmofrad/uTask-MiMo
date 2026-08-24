"use client";

import type { GanttLink, GanttRow } from "@/lib/gantt-types";
import { linkShortLabel } from "@/lib/gantt/links";
import type { TimelineGeometry } from "./use-gantt-timeline";

const BOX_WIDTH = 64;
const LEFT_WIDTH = 288;
const ROW_HEIGHT = 52;

type LinkErrorKey =
  | "loadError"
  | "cycleError"
  | "selfError"
  | "sameProjectError"
  | "duplicateError"
  | "blocked";

export function linkErrorKey(code?: string): LinkErrorKey {
  switch (code) {
    case "SELF": return "selfError";
    case "DUPLICATE": return "duplicateError";
    case "CROSS_PROJECT": return "sameProjectError";
    case "DEPENDENCY_CYCLE": return "cycleError";
    case "DEPENDENCY_BLOCKED": return "blocked";
    default: return "loadError";
  }
}

export function GanttLinkArrows({
  links, rows, rowIndex, linkMode, geo, t, onRemoveLink,
}: {
  links: GanttLink[];
  rows: GanttRow[];
  rowIndex: Map<string, number>;
  linkMode: boolean;
  geo: Pick<TimelineGeometry, "dayPos" | "dateFor" | "isInvalidLink" | "direction" | "totalDays"> & { rangeStart: Date };
  t: (_key: string) => string;
  onRemoveLink?: (_link: GanttLink) => void;
}) {
  const { dayPos, dateFor, isInvalidLink, direction, totalDays } = geo;
  const timelineOrigin = direction === "rtl" ? 0 : LEFT_WIDTH;

  return (
    <svg
      className={`absolute inset-0 pointer-events-none ${linkMode ? "z-30" : ""}`}
      width={(totalDays + 1) * 64 + LEFT_WIDTH}
      height={rows.length * ROW_HEIGHT}
    >
      <defs>
        <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className="fill-fg-muted" />
        </marker>
      </defs>
      {links.map((link) => {
        const sRow = rowIndex.get(link.source);
        const tRow = rowIndex.get(link.target);
        if (sRow == null || tRow == null) return null;
        const sTask = rows[sRow];
        const tTask = rows[tRow];
        if (!sTask || !tTask) return null;
        const sEnd = dateFor(sTask).end ?? dateFor(sTask).start;
        const tStart = dateFor(tTask).start ?? dateFor(tTask).end;
        if (!sEnd || !tStart) return null;
        const x1 = timelineOrigin + (direction === "rtl" ? dayPos(sEnd, BOX_WIDTH) : dayPos(sEnd, BOX_WIDTH) + BOX_WIDTH);
        const y1 = sRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = timelineOrigin + dayPos(tStart, 0);
        const y2 = tRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const mx = (x1 + x2) / 2;
        const invalid = isInvalidLink(sTask, tTask);
        return (
          <g key={link.id} data-testid="gantt-link-arrow"
            data-link-source={link.source} data-link-target={link.target}
            className={linkMode ? "cursor-pointer" : ""}
            onClick={linkMode && onRemoveLink ? () => onRemoveLink(link) : undefined}
            role={linkMode ? "button" : undefined}
            aria-label={linkMode ? t("dependencies.remove") : undefined}
          >
            {linkMode && <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="transparent" strokeWidth={12} style={{ pointerEvents: "stroke" }} />}
            <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="currentColor"
              strokeWidth={invalid ? 1.5 : 1}
              className={`${invalid ? "text-danger" : "text-fg-subtle"} ${linkMode ? "hover:opacity-70" : ""}`}
              markerEnd="url(#gantt-arrow)"
            >
              {invalid ? <title>{t("ganttInvalidDep")}</title> : null}
            </path>
            <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle"
              className="fill-fg-subtle stroke-bg-primary font-mono"
              style={{ fontSize: 10, paintOrder: "stroke", strokeWidth: 3, strokeLinejoin: "round", pointerEvents: "none" }}
            >
              {linkShortLabel(link)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export type { LinkErrorKey };

/** Re-export the box/row constants for consumers */
export const GANTT_CONSTANTS = { BOX_WIDTH, LEFT_WIDTH, ROW_HEIGHT } as const;
