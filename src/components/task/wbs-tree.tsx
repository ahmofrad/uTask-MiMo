"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export type WBSTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
};

type WBSTreeProps = {
  tasks: WBSTask[];
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-info",
  in_progress: "bg-warning",
  done: "bg-success",
  cancelled: "bg-fg-subtle",
};

function TreeNode({
  task,
  childrenMap,
  depth,
  code,
}: {
  task: WBSTask;
  childrenMap: Map<string, WBSTask[]>;
  depth: number;
  code: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const childTasks = childrenMap.get(task.id) ?? [];
  const hasChildren = childTasks.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-bg-secondary transition-colors group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-4 h-4 flex items-center justify-center shrink-0 text-fg-muted hover:text-fg-primary transition-colors ${
            hasChildren ? "cursor-pointer" : "invisible"
          }`}
        >
          {hasChildren && (
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        <span className="text-[10px] font-mono text-fg-subtle w-10 shrink-0">{code}</span>

        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[task.status] || "bg-info"}`} />

        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium text-fg-primary hover:text-accent truncate flex-1"
        >
          {task.title}
        </Link>

        <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-fg-muted capitalize shrink-0">
          {task.priority}
        </span>

        {task.assigneeNames.length > 0 && (
          <span className="text-[10px] text-fg-muted shrink-0 hidden sm:inline truncate max-w-[160px]">
            {task.assigneeNames.join(", ")}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {childTasks.map((child, i) => (
            <TreeNode key={child.id} task={child} childrenMap={childrenMap} depth={depth + 1} code={`${code}.${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WBSTree({ tasks }: WBSTreeProps) {
  const t = useTranslations("task");
  const childrenMap = new Map<string, WBSTask[]>();

  for (const task of tasks) {
    const key = task.parentTaskId ?? "";
    const siblings = childrenMap.get(key) ?? [];
    siblings.push(task);
    childrenMap.set(key, siblings);
  }

  const rootTasks = childrenMap.get("") ?? [];

  if (rootTasks.length === 0) {
    return (
      <div className="text-center py-12 text-fg-muted text-sm">
        {t("wbsNoTasks")}
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-fg-muted">
        <span>{totalTasks} {t("wbsTotal")}</span>
        <span>{doneTasks} {t("wbsCompleted")}</span>
        {totalTasks > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
              />
            </div>
            <span>{Math.round((doneTasks / totalTasks) * 100)}%</span>
          </div>
        )}
      </div>

      <div className="border border-border-primary rounded-lg overflow-hidden">
        {rootTasks.map((task, i) => (
          <div key={task.id} className="border-b border-border-secondary last:border-b-0">
            <TreeNode task={task} childrenMap={childrenMap} depth={0} code={`${i + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
