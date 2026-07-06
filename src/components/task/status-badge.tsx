"use client";

import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

const statusConfig = {
  open: { labelKey: "status.open" as const, className: "!bg-info-bg !text-info !border-info/20" },
  in_progress: { labelKey: "status.in_progress" as const, className: "!bg-warning-bg !text-warning !border-warning/20" },
  done: { labelKey: "status.done" as const, className: "!bg-success-bg !text-success !border-success/20" },
  cancelled: { labelKey: "status.cancelled" as const, className: "!bg-bg-surface-2 !text-fg-subtle !border-border" },
};

type StatusBadgeProps = {
  status: keyof typeof statusConfig;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("task");
  const cfg = statusConfig[status] ?? statusConfig.open;
  return <Badge variant="outline" className={cn(cfg.className, "border", className)}>{t(cfg.labelKey)}</Badge>;
}
