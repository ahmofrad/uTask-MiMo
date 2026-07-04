import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

const priorityConfig = {
  none: { label: "None", className: "bg-bg-surface-2 text-fg-subtle border-border" },
  low: { label: "Low", className: "!bg-bg-surface-2 !text-priority-low !border-priority-low/20" },
  medium: { label: "Medium", className: "!bg-info-bg !text-info !border-info/20" },
  high: { label: "High", className: "!bg-warning-bg !text-warning !border-warning/20" },
  urgent: { label: "Urgent", className: "!bg-danger-bg !text-destructive !border-danger/20" },
} as const;

type PriorityBadgeProps = {
  priority: keyof typeof priorityConfig;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const cfg = priorityConfig[priority] ?? priorityConfig.none;
  return <Badge variant="outline" className={cn(cfg.className, "border", className)}>{cfg.label}</Badge>;
}
