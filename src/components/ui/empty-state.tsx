import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import type { IconName } from "@/components/icons/registry";

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      <div className="w-12 h-12 rounded-full bg-bg-surface-2 flex items-center justify-center mb-3">
        <Icon name={icon} size={22} className="text-fg-muted" aria-hidden />
      </div>
      <p className="text-sm font-medium text-fg-primary">{title}</p>
      {description && <p className="text-sm text-fg-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
