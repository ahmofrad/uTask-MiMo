"use client";

import { useTranslations } from "next-intl";
import { linkLagSuffix } from "@/lib/gantt/links";
import { type DepEdge, typeLabelKey } from "./dep-types";

export function DepIncomingList({ edges }: { edges: DepEdge[] }) {
  const t = useTranslations("task");
  const typeLabel = (tp: string) => t(typeLabelKey(tp));

  if (edges.length === 0) {
    return <p className="text-sm text-fg-muted">{t("dependencies.none")}</p>;
  }

  return (
    <ul className="space-y-1">
      {edges.map((e) => (
        <li key={e.id} className="flex items-center gap-2 text-sm">
          <span className="truncate">{e.dependent?.title ?? e.taskId}</span>
          <span className="text-xs text-fg-muted shrink-0">
            {typeLabel(e.type)}<span className="font-mono">{linkLagSuffix(e)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}