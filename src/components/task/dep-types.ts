export type DepEdge = {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "RELATES_TO";
  lag: number;
  lagUnit: "DAY" | "HOUR";
  predecessor?: { id: string; title: string; status: string } | null;
  dependent?: { id: string; title: string; status: string } | null;
};

export type DepResponse = { outgoing: DepEdge[]; incoming: DepEdge[] };

export type Candidate = { id: string; title: string };

export const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
export type LinkType = (typeof DEP_TYPES)[number];
export type LagUnit = "DAY" | "HOUR";

export type DepEdit = { type: LinkType; lag: number; lagUnit: LagUnit };

const TYPE_KEY: Record<LinkType, string> = {
  FINISH_TO_START: "typeFS",
  START_TO_START: "typeSS",
  FINISH_TO_FINISH: "typeFF",
  RELATES_TO: "typeRelates",
};

/** i18n key for a link type (resolved by the caller's `useTranslations`). */
export function typeLabelKey(tp: string): string {
  return `dependencies.${TYPE_KEY[(tp as LinkType)] ?? TYPE_KEY.FINISH_TO_START}`;
}

/** Maps an API error code to an i18n key under `task.dependencies.*`. */
export function dependencyErrorKey(code?: string): string {
  switch (code) {
    case "SELF":
      return "selfError";
    case "DUPLICATE":
      return "duplicateError";
    case "CROSS_PROJECT":
      return "sameProjectError";
    case "DEPENDENCY_CYCLE":
      return "cycleError";
    case "DEPENDENCY_BLOCKED":
      return "blocked";
    default:
      return "duplicateError";
  }
}