import { cn } from "@/lib/cn";

type DashboardCardProps = {
  label: string;
  value: string | number;
  trend?: { direction: "up" | "down"; value: string };
  icon?: React.ReactNode;
  className?: string;
};

export function DashboardCard({ label, value, trend, icon, className }: DashboardCardProps) {
  return (
    <div className={cn("bg-bg-surface border border-border rounded-lg p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-fg-muted font-medium">{label}</p>
          <p className="text-2xl font-bold text-fg mt-1">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs mt-1",
              trend.direction === "up" ? "text-success" : "text-destructive",
            )}>
              {trend.direction === "up" ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        {icon && <div className="text-fg-muted">{icon}</div>}
      </div>
    </div>
  );
}
