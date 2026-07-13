"use client";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type AssigneeUser = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

type AssigneeStackProps = {
  assignees: AssigneeUser[];
  size?: "sm" | "md";
  max?: number;
};

export function AssigneeStack({ assignees, size = "sm", max = 3 }: AssigneeStackProps) {
  if (!assignees || assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;

  return (
    <div className="flex items-center -space-s-1.5">
      {shown.map((a) => (
        <Avatar
          key={a.id}
          initials={a.displayName}
          imageUrl={a.avatarUrl}
          size={size}
          className="ring-2 ring-bg-surface"
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-bg-secondary text-fg-muted font-medium ring-2 ring-bg-surface",
            size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm",
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
