import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  open: { label: "Open", className: "!bg-info-bg !text-info !border-info/20" },
  in_progress: { label: "In Progress", className: "!bg-warning-bg !text-warning !border-warning/20" },
  done: { label: "Done", className: "!bg-success-bg !text-success !border-success/20" },
  cancelled: { label: "Cancelled", className: "!bg-bg-surface-2 !text-fg-subtle !border-border" },
} as const;

type StatusBadgeProps = {
  status: keyof typeof statusConfig;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? statusConfig.open;
  return <Badge variant="outline" className={cn(cfg.className, "border", className)}>{cfg.label}</Badge>;
}
