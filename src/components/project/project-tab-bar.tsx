"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type ProjectTab = "board" | "timeline" | "calendar" | "gantt" | "wbs" | "tasks";

type TabDef = {
  key: ProjectTab;
  label: string;
  icon: React.ReactNode;
};

type Props = {
  tabs: TabDef[];
  activeTab: ProjectTab;
  canCreate: boolean;
  onCreate: () => void;
  onTabChange: (_tab: ProjectTab) => void;
};

export const ProjectTabBar = memo(function ProjectTabBar({
  tabs,
  activeTab,
  canCreate,
  onCreate,
  onTabChange,
}: Props) {
  const taskT = useTranslations("task");

  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex items-center gap-1 p-1 bg-bg-surface-2 rounded-lg overflow-x-auto scrollbar-hide flex-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0",
              activeTab === tab.key
                ? "bg-bg-primary text-fg-primary shadow-sm"
                : "text-fg-muted hover:text-fg-secondary",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      {canCreate && (
        <button
          onClick={onCreate}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
        >
          + {taskT("create")}
        </button>
      )}
    </div>
  );
});