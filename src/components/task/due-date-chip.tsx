"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { formatDate, type Locale } from "@/lib/date/format";

type DueDateChipProps = {
  dueDate: string | null;
  isCompleted?: boolean;
  className?: string;
};

export function DueDateChip({ dueDate, isCompleted, className }: DueDateChipProps) {
  const locale = useLocale() as Locale;
  if (!dueDate) return null;

  const date = new Date(dueDate);
  const now = new Date();
  const isOverdue = date < now && !isCompleted;
  const isSoon = date < new Date(now.getTime() + 24 * 60 * 60 * 1000) && !isCompleted;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md",
        isCompleted && "text-success bg-success-bg",
        isOverdue && "text-destructive bg-danger-bg",
        isSoon && !isOverdue && "text-warning bg-warning-bg",
        !isCompleted && !isOverdue && !isSoon && "text-fg-muted bg-bg-surface-2",
        className,
      )}
    >
      {formatDate(date, locale)}
    </span>
  );
}
