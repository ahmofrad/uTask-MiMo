"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

type Watcher = { id: string; displayName: string; avatarUrl?: string | null; addedAt: string };
type Member = { id: string; displayName: string; avatarUrl?: string | null };

type Props = {
  watchers: Watcher[];
  projectMembers: Member[];
  currentUserId: string;
  isWatching: boolean;
  onAddWatcher: (_userId: string) => void;
  onRemoveWatcher: (_userId: string) => void;
  onToggleWatch: () => void;
};

export const TaskWatchersCard = memo(function TaskWatchersCard({
  watchers,
  projectMembers,
  currentUserId,
  isWatching,
  onAddWatcher,
  onRemoveWatcher,
  onToggleWatch,
}: Props) {
  const t = useTranslations();

  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
          {t("task.watchers")}
        </h4>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => {
              const userId = e.target.value;
              e.target.value = "";
              if (userId) onAddWatcher(userId);
            }}
            className="text-xs bg-transparent border border-border-primary rounded px-1.5 py-0.5 text-fg-muted"
          >
            <option value="">+ {t("task.addWatcher")}</option>
            {projectMembers
              .filter((m) => !watchers.some((w) => w.id === m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
          </select>
          <button
            onClick={onToggleWatch}
            className={cn(
              "text-xs px-2 py-0.5 rounded-md border transition-colors",
              isWatching
                ? "border-accent/30 text-accent hover:bg-accent/10"
                : "border-border text-fg-muted hover:text-fg hover:border-fg-muted",
            )}
          >
            {isWatching ? t("task.watching") : t("task.watch")}
          </button>
        </div>
      </div>
      {watchers.length > 0 ? (
        <div className="space-y-1.5">
          {watchers.map((w) => (
            <div key={w.id} className="flex items-center gap-2 text-sm text-fg-muted group">
              <Avatar initials={w.displayName.slice(0, 2).toUpperCase()} size="sm" />
              <span className="truncate flex-1">{w.displayName || t("common.you")}</span>
              {w.id !== currentUserId && (
                <button
                  onClick={() => onRemoveWatcher(w.id)}
                  className="text-xs text-fg-muted opacity-0 group-hover:opacity-100 hover:text-destructive transition-[opacity,color]"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">{t("task.noWatchers")}</p>
      )}
    </div>
  );
});