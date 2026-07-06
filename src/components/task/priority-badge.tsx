"use client";

import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

const priorityConfig = {
  low: { labelKey: "priority.low" as const, className: "!bg-bg-surface-2 !text-priority-low !border-priority-low/20" },
  med: { labelKey: "priority.med" as const, className: "!bg-info-bg !text-info !border-info/20" },
  high: { labelKey: "priority.high" as const, className: "!bg-warning-bg !text-warning !border-warning/20" },
  urgent: { labelKey: "priority.urgent" as const, className: "!bg-danger-bg !text-destructive !border-danger/20" },
};

type PriorityBadgeProps = {
  priority: keyof typeof priorityConfig;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const t = useTranslations("task");
  const cfg = priorityConfig[priority] ?? priorityConfig.low;
  return <Badge variant="outline" className={cn(cfg.className, "border", className)}>{t(cfg.labelKey)}</Badge>;
}
