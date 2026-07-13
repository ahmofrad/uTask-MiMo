"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Board } from "@/components/task/board";
import { Timeline } from "@/components/task/timeline";
import { CalendarView } from "@/components/task/calendar-view";
import { GanttView } from "@/components/task/gantt-view";
import { WBSTree } from "@/components/task/wbs-tree";
import { TaskCard } from "@/components/task/task-card";
import { cn } from "@/lib/cn";

type DashboardStat = {
  label: string;
  value: number;
  color: "accent" | "danger" | "success" | "info";
};

type RecentTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName: string;
  updatedAt: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  taskCount: number;
  memberCount: number;
};

type DashboardPageProps = {
  stats: DashboardStat[];
  recentTasks: RecentTask[];
  allTasks: { id: string; title: string; description: string | null; status: string; priority: string; dueDate: string | null; assigneeId: string | null; startDate: string | null; parentTaskId: string | null; assignee: { displayName: string; avatarUrl: string | null } | null; projectId: string; projectName: string; tags: { id: string; name: string }[]; subtaskCount: number; subtaskDone: number; progress?: number | null }[];
  projects: ProjectSummary[];
  userId: string;
};

const STAT_COLORS = {
  accent: "bg-accent-bg text-accent",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
};

type Tab = "board" | "timeline" | "calendar" | "gantt" | "wbs" | "tasks";

export function DashboardPage({ stats, recentTasks: _recentTasks, allTasks, projects: _projects, userId }: DashboardPageProps) {
  useTranslations("reports");
  const taskT = useTranslations("task");
  const [activeTab, setActiveTab] = useState<Tab>("board");
  const [taskFilter, setTaskFilter] = useState<"all" | "mine">("all");

  // Load the persisted filter after mount so server and client render the same
  // initial markup (reading localStorage during the first render causes a
  // hydration mismatch).
  useEffect(() => {
    const stored = localStorage.getItem("dashboardTaskFilter");
    if (stored === "all" || stored === "mine") {
      setTaskFilter(stored);
    }
  }, []);

  function handleFilterChange(value: "all" | "mine") {
    setTaskFilter(value);
    localStorage.setItem("dashboardTaskFilter", value);
  }

  const filteredTasks = taskFilter === "mine"
    ? allTasks.filter((t) => t.assigneeId === userId)
    : allTasks;

  const tabs = [
    { key: "board" as Tab, label: taskT("board"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m6-10a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m10 0a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7" /></svg> },
    { key: "timeline" as Tab, label: taskT("timeline"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { key: "calendar" as Tab, label: taskT("calendar"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { key: "gantt" as Tab, label: "Gantt", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg> },
    { key: "wbs" as Tab, label: "WBS", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h12M4 14h8M4 18h4" /></svg> },
    { key: "tasks" as Tab, label: taskT("title"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards (always visible) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border border-border-primary p-5 ${STAT_COLORS[s.color]}`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm opacity-80 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center justify-between gap-2 p-1 bg-bg-surface-2 rounded-lg">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0",
                activeTab === tab.key
                  ? "bg-bg-primary text-fg-primary shadow-sm"
                  : "text-fg-muted hover:text-fg-secondary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={taskFilter}
          onChange={(e) => handleFilterChange(e.target.value as "all" | "mine")}
          className="px-3 py-1.5 text-sm border border-border-primary rounded-md bg-bg-primary text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="all">{taskT("allTasks")}</option>
          <option value="mine">{taskT("myTasks")}</option>
        </select>
      </div>

      {/* Tab Content */}
      {activeTab === "board" && (
        <Board initialTasks={filteredTasks.map((t) => ({
          id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
          projectId: "", assigneeId: t.assigneeId, dueDate: t.dueDate,
          assignee: t.assignee, projectName: t.projectName,
          tags: t.tags, subtaskCount: t.subtaskCount, subtaskDone: t.subtaskDone,
        }))} projectId="" />
      )}

      {activeTab === "timeline" && (
        <Timeline tasks={filteredTasks.map((t) => ({
          id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
          dueDate: t.dueDate, assigneeId: t.assigneeId,
          assignee: t.assignee, projectName: t.projectName,
          tags: t.tags, subtaskCount: t.subtaskCount, subtaskDone: t.subtaskDone,
        }))} showProject />
      )}

      {activeTab === "calendar" && (
        <CalendarView tasks={filteredTasks.map((t) => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          dueDate: t.dueDate,
          progress: t.progress ?? null,
        }        ))} />
      )}

      {activeTab === "gantt" && (
        <div className="space-y-6">
          {Object.values(
            filteredTasks.reduce<Record<string, { projectId: string; projectName: string; tasks: typeof filteredTasks }>>(
              (acc, t) => {
                const group = (acc[t.projectId] ??= { projectId: t.projectId, projectName: t.projectName, tasks: [] });
                group.tasks.push(t);
                return acc;
              },
              {},
            ),
          ).map((group) => (
            <div key={group.projectId} className="space-y-2">
              <h3 className="text-sm font-medium text-fg-muted">{group.projectName}</h3>
              <GanttView projectId={group.projectId} />
            </div>
          ))}
        </div>
      )}

      {activeTab === "wbs" && (
        <WBSTree tasks={filteredTasks.map((t) => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          startDate: t.startDate, dueDate: t.dueDate, assigneeId: t.assigneeId,
          parentTaskId: t.parentTaskId,
        }))} />
      )}

      {activeTab === "tasks" && (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={{
                id: task.id, title: task.title, description: task.description,
                status: task.status, priority: task.priority,
                dueDate: task.dueDate, assignee: task.assignee, projectName: task.projectName,
                tags: task.tags, subtaskCount: task.subtaskCount, subtaskDone: task.subtaskDone,
              }}
              variant="list"
              showProject
            />
          ))}
          {filteredTasks.length === 0 && (
            <p className="text-sm text-fg-muted text-center py-8">No tasks</p>
          )}
        </div>
      )}
    </div>
  );
}
