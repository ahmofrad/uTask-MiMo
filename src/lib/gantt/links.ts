import type { GanttLink } from "@/lib/gantt-types";

const TYPE_SHORT: Record<string, string> = {
  FINISH_TO_START: "FS",
  START_TO_START: "SS",
  FINISH_TO_FINISH: "FF",
  RELATES_TO: "R",
};

/** Compact arrow label: dependency type abbreviation plus lag, e.g. "FS +2d". */
export function linkShortLabel(link: Pick<GanttLink, "type" | "lag" | "lagUnit">): string {
  const type = TYPE_SHORT[link.type] ?? "FS";
  if (link.lag === 0) return type;
  const unit = link.lagUnit === "HOUR" ? "h" : "d";
  return `${type} ${link.lag > 0 ? "+" : ""}${link.lag}${unit}`;
}

/** Human-readable suffix shown next to a dependency row, e.g. "+2 days". */
export function linkLagSuffix(link: Pick<GanttLink, "lag" | "lagUnit">): string {
  if (link.lag === 0) return "";
  const unit = link.lagUnit === "HOUR" ? "h" : "d";
  return ` ${link.lag > 0 ? "+" : ""}${link.lag}${unit}`;
}
