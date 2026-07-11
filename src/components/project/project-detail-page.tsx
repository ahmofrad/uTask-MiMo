"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TagsModal } from "@/components/tags/tags-modal";
import { Board } from "@/components/task/board";
import { Timeline } from "@/components/task/timeline";
import { CalendarView } from "@/components/task/calendar-view";
import { GanttChart } from "@/components/task/gantt-chart";
import { WbsEditor } from "@/components/task/wbs-editor";
import { TaskCard } from "@/components/task/task-card";
import { TaskForm } from "@/components/task/task-form";
import { CustomFieldsManager } from "@/components/custom-field/custom-fields-manager";
import { MembersModal } from "@/components/project/members-modal";
import { apiFetch } from "@/lib/api-fetch";

type ProjectInfo = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  ownerName: string;
  memberCount: number;
  taskCount: number;
  members: { id: string; displayName: string; avatarUrl?: string | null }[];
  projectRole: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  projectId: string;
  assigneeId: string | null;
  dueDate: string | null;
  startDate: string | null;
  parentTaskId: string | null;
  orderIndex: number;
  assignee?: { displayName: string; avatarUrl: string | null } | null;
  tags?: { id: string; name: string }[];
  subtaskCount?: number;
  subtaskDone?: number;
};

type ProjectDetailPageProps = {
  project: ProjectInfo;
  initialTasks: TaskItem[];
};

type Tab = "board" | "timeline" | "calendar" | "gantt" | "wbs" | "tasks";

export function ProjectDetailPage({ project, initialTasks }: ProjectDetailPageProps) {
  const t = useTranslations("project");
  const taskT = useTranslations("task");
  const [tasks, setTasks] = useState(initialTasks);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCFModal, setShowCFModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [projectTags, setProjectTags] = useState<{ id: string; name: string; color?: string | null }[]>([]);
  const [cfFields, setCfFields] = useState<Array<{ id: string; name: string; key: string; type: string; required: boolean }>>([]);
  const [cfLoading, setCfLoading] = useState(false);

  async function openCFModal() {
    setShowCFModal(true);
    setCfLoading(true);
    try {
      const res = await apiFetch(`/api/v1/projects/${project.id}/custom-fields`);
      if (res.ok) {
        const body = await res.json();
        setCfFields(body.data ?? []);
      }
    } finally {
      setCfLoading(false);
    }
  }
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("board");

  useEffect(() => {
    apiFetch(`/api/v1/tags?projectId=${project.id}`)
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json();
          setProjectTags(body.data ?? []);
        }
      })
      .catch(() => {});
  }, [project.id]);

  async function handleCreateTask(data: Record<string, unknown>) {
    const res = await apiFetch(`/api/v1/tasks`, {
      method: "POST",
      body: JSON.stringify({ ...data, projectId: project.id }),
    });
    if (res.ok) {
      const result = await res.json();
      setTasks((prev) => [...prev, {
        id: result.data.id,
        title: result.data.title,
        status: result.data.status,
        priority: result.data.priority,
        projectId: project.id,
        assigneeId: result.data.assigneeId,
        dueDate: result.data.dueDate?.toISOString() ?? null,
        startDate: result.data.startDate?.toISOString() ?? null,
        parentTaskId: result.data.parentTaskId ?? null,
        orderIndex: result.data.orderIndex ?? 0,
      }]);
      setShowCreateForm(false);
    }
  }

  async function handleBoardDelete(taskId: string) {
    await apiFetch(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "board", label: taskT("board"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m6-10a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m10 0a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7" /></svg> },
    { key: "timeline", label: taskT("timeline"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { key: "calendar", label: taskT("calendar"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { key: "gantt", label: "Gantt", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg> },
    { key: "wbs", label: "WBS", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h12M4 14h8M4 18h4" /></svg> },
    { key: "tasks", label: taskT("title"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  ];

  return (
    <>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors mb-3"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("backToProjects")}
      </Link>

      {/* Project Header */}
      <div className="bg-bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {project.color && (
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            )}
            <h1 className="text-xl font-bold text-fg-primary">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCFModal()}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
            >
              {t("customFields")}
            </button>
            <button
              type="button"
              onClick={() => setShowTagsModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
            >
              {t("tags")}
            </button>
          </div>
        </div>
        {project.description && (
          <p className="text-sm text-fg-muted mb-4">{project.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-fg-subtle">
          <span>{t("owner")}: {project.ownerName}</span>
          <span>{t("tasksCount", { count: project.taskCount })}</span>
          <button onClick={() => setShowMembersModal(true)} className="hover:text-accent transition-colors underline underline-offset-2">
            {t("membersCount", { count: project.memberCount })}
          </button>
        </div>
        {projectTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {projectTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border"
                style={{ backgroundColor: tag.color ? `${tag.color}22` : undefined, borderColor: tag.color ?? "#cbd5e1", color: tag.color ?? "inherit" }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center gap-1 p-1 bg-bg-surface-2 rounded-lg overflow-x-auto scrollbar-hide flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
        >
          + {taskT("create")}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "board" && (
        <div>
          <Board initialTasks={tasks} projectId={project.id} onDelete={handleBoardDelete} />
        </div>
      )}

      {activeTab === "timeline" && (
        <div>
          <Timeline tasks={tasks} />
        </div>
      )}

      {activeTab === "calendar" && (
        <div>
          <CalendarView tasks={tasks} />
        </div>
      )}

      {activeTab === "gantt" && (
        <div>
          <GanttChart tasks={tasks.map((t) => ({
            ...t,
            startDate: t.startDate ?? null,
            parentTaskId: t.parentTaskId ?? null,
          }))} />
        </div>
      )}

      {activeTab === "wbs" && (
        <div>
          <WbsEditor projectId={project.id} />
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="list"
            />
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-fg-muted text-center py-8">No tasks in this project</p>
          )}
        </div>
      )}

      {/* Task Create Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
          <div className="relative bg-bg-primary border border-border-primary rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-fg-primary mb-4">{taskT("createTask")}</h2>
            <TaskForm projectId={project.id} onSubmit={handleCreateTask} onCancel={() => setShowCreateForm(false)} />
          </div>
        </div>
      )}

      {/* Custom Fields Modal */}
      {showCFModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCFModal(false)} />
          <div className="relative bg-bg-primary border border-border-primary rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-fg-primary">{t("customFields")}</h2>
              <button onClick={() => setShowCFModal(false)} className="text-fg-muted hover:text-fg-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {cfLoading ? (
              <p className="text-sm text-fg-muted text-center py-8">{t("loading")}</p>
            ) : (
              <CustomFieldsManager projectId={project.id} initialFields={cfFields} />
            )}
          </div>
        </div>
      )}

      <MembersModal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        projectId={project.id}
      />

      <TagsModal
        projectId={project.id}
        open={showTagsModal}
        onClose={() => setShowTagsModal(false)}
        onChanged={() =>
          apiFetch(`/api/v1/tags?projectId=${project.id}`)
            .then(async (res) => {
              if (res.ok) setProjectTags((await res.json()).data ?? []);
            })
            .catch(() => {})
        }
      />
    </>
  );
}
