"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TagsModal } from "@/components/tags/tags-modal";
import { Board } from "@/components/task/board";
import { Timeline } from "@/components/task/timeline";
import { CalendarView } from "@/components/task/calendar-view";
import { GanttView } from "@/components/task/gantt-view";
import { WbsEditor } from "@/components/task/wbs-editor";
import { ProjectTaskList, type CustomFieldFilterDef } from "@/components/task/project-task-list";
import { TaskForm } from "@/components/task/task-form";
import { CustomFieldsManager } from "@/components/custom-field/custom-fields-manager";
import { MembersModal } from "@/components/project/members-modal";
import { ProjectDetailHeader } from "@/components/project/project-detail-header";
import { ProjectSettingsModal } from "@/components/project/project-settings-modal";
import { ProjectDepartmentLinks } from "@/components/project/project-department-links";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

type ProjectInfo = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  status?: string;
  visibility?: string;
  ownerName: string;
  ownerId: string;
  isOwner: boolean;
  canManage: boolean;
  memberCount: number;
  taskCount: number;
  members: { id: string; displayName: string; avatarUrl?: string | null }[];
  projectRole: string | null;
  canAssignRoles: boolean;
  ragStatus: "GREEN" | "AMBER" | "RED";
  ragReason: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  projectId: string;
  assignees?: { id: string; displayName: string; avatarUrl?: string | null }[];
  dueDate: string | null;
  startDate: string | null;
  parentTaskId: string | null;
  orderIndex: number;
  tags?: { id: string; name: string }[];
  subtaskCount?: number;
  subtaskDone?: number;
  progress?: number | null;
  blockedBy?: { id: string; title: string; status: string; startDate: string | null; dueDate: string | null }[];
};

type ProjectDetailPageProps = {
  project: ProjectInfo;
  initialTasks: TaskItem[];
  currentUserId: string | undefined;
};

type Tab = "board" | "timeline" | "calendar" | "gantt" | "wbs" | "tasks";

export const ProjectDetailPage = memo(function ProjectDetailPage({ project, initialTasks, currentUserId }: ProjectDetailPageProps) {
  const t = useTranslations("project");
  const taskT = useTranslations("task");
  // RAG health is editable in the header; keep it in state so a save updates
  // the badge without a full page reload.
  const [ragStatus, setRagStatus] = useState<"GREEN" | "AMBER" | "RED">(project.ragStatus);
  const [ragReason, setRagReason] = useState<string | null>(project.ragReason);
  const [tasks, setTasks] = useState(initialTasks);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCFModal, setShowCFModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [projectTags, setProjectTags] = useState<{ id: string; name: string; color?: string | null }[]>([]);
  const [cfFields, setCfFields] = useState<Array<{ id: string; name: string; key: string; type: string; required: boolean; configJson?: CustomFieldFilterDef["configJson"] }>>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("board");

  const canEdit = project.isOwner;
  const canManage = project.canManage;
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");

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

  async function saveName(val: string) {
    if (!val || val === name) return;
    try {
      const res = await apiFetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: val }),
      });
      if (res.ok) {
        const json = await res.json();
        setName(json.data.name);
      }
    } catch {
      // keep the previous name
    }
  }

  async function saveDesc(val: string | null) {
    if (val === desc) return;
    try {
      const res = await apiFetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: val }),
      });
      if (res.ok) {
        const json = await res.json();
        setDesc(json.data.description ?? "");
      }
    } catch {
      // keep the previous description
    }
  }

  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const settingsInitial = useMemo(
    () => ({
      status: (project.status ?? "active") as "active" | "archived",
      visibility: project.visibility ?? "private",
      color: project.color ?? "#4f46e5",
    }),
    [project.status, project.visibility, project.color],
  );

  async function saveSettings(values: { status: "active" | "archived"; visibility: string; color: string }) {
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setSettingsError(json?.error?.message ?? t("editError"));
      } else {
        setShowSettings(false);
      }
    } catch {
      setSettingsError(t("editError"));
    } finally {
      setSettingsSaving(false);
    }
  }

  useEffect(() => {
    apiFetch(`/api/v1/tags?projectId=${project.id}`)
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json();
          setProjectTags(body.data ?? []);
        }
      })
      .catch(() => {});

    apiFetch(`/api/v1/projects/${project.id}/custom-fields`)
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json();
          setCfFields(body.data ?? []);
        }
      })
      .catch(() => {});
  }, [project.id]);

  async function handleCreateTask(data: Record<string, unknown>) {
    const { dependsOnId, ...createPayload } = data;
    const res = await apiFetch(`/api/v1/tasks`, {
      method: "POST",
      body: JSON.stringify({ ...createPayload, projectId: project.id }),
    });
    if (res.ok) {
      const result = await res.json();
      // The task was created with a chosen predecessor — wire up the
      // dependency (non-fatal if it fails; the task itself is already saved).
      if (typeof dependsOnId === "string" && dependsOnId) {
        void apiFetch(`/api/v1/projects/${project.id}/tasks/${result.data.id}/dependencies`, {
          method: "POST",
          body: JSON.stringify({ dependsOnId, type: "FINISH_TO_START", lag: 0, lagUnit: "DAY" }),
        }).catch(() => {});
      }
      setTasks((prev) => [...prev, {
        id: result.data.id,
        title: result.data.title,
        status: result.data.status,
        priority: result.data.priority,
        projectId: project.id,
        assignees: (result.data.assignees ?? []).map((a: { id: string; displayName: string; avatarUrl?: string | null }) => ({
          id: a.id,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
        })),
        dueDate: result.data.dueDate?.toISOString() ?? null,
        startDate: result.data.startDate?.toISOString() ?? null,
        parentTaskId: result.data.parentTaskId ?? null,
        orderIndex: result.data.orderIndex ?? 0,
        progress: result.data.progress ?? 0,
      }]);
      setShowCreateForm(false);
    }
  }

  async function handleCalendarMove(taskId: string, dueDate: string, startDate: string | null) {
    await apiFetch(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ dueDate, startDate }),
    });
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "board", label: taskT("board"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m6-10a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m10 0a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7" /></svg> },
    { key: "timeline", label: taskT("timeline"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { key: "calendar", label: taskT("calendar"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { key: "gantt", label: taskT("gantt"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg> },
    { key: "wbs", label: taskT("wbs"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h12M4 14h8M4 18h4" /></svg> },
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

      <ProjectDetailHeader
        project={{ ...project, ragStatus, ragReason }}
        name={name}
        desc={desc}
        canEdit={canEdit}
        canManage={canManage}
        projectTags={projectTags}
        onSaveName={saveName}
        onSaveDesc={saveDesc}
        onOpenSettings={() => {
          setSettingsError(null);
          setShowSettings(true);
        }}
        onOpenCF={() => void openCFModal()}
        onOpenTags={() => setShowTagsModal(true)}
        onOpenMembers={() => setShowMembersModal(true)}
        onSaveHealth={async (status, reason) => {
          const res = await apiFetch(`/api/v1/projects/${project.id}/health`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ragStatus: status, ragReason: reason }),
          });
          if (res.ok) {
            setRagStatus(status);
            setRagReason(reason);
          }
          return res;
        }}
      />

      <ProjectDepartmentLinks projectId={project.id} canManage={canManage} />

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
          <Board initialTasks={tasks} projectId={project.id} currentUserId={currentUserId} />
        </div>
      )}

      {activeTab === "timeline" && (
        <div>
          <Timeline tasks={tasks} />
        </div>
      )}

      {activeTab === "calendar" && (
        <div>
          <CalendarView tasks={tasks} onMove={handleCalendarMove} />
        </div>
      )}

      {activeTab === "gantt" && (
        <div>
          <GanttView projectId={project.id} currentUserId={currentUserId} />
        </div>
      )}

      {activeTab === "wbs" && (
        <div>
          <WbsEditor projectId={project.id} showHeader={false} />
        </div>
      )}

      {activeTab === "tasks" && (
        <ProjectTaskList
          projectId={project.id}
          initialTasks={tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description ?? null,
            status: task.status,
            priority: task.priority,
            assignees: task.assignees ?? [],
            dueDate: task.dueDate,
            startDate: task.startDate,
            tags: task.tags ?? [],
            subtaskCount: task.subtaskCount ?? 0,
            subtaskDone: task.subtaskDone ?? 0,
            blockedBy: task.blockedBy ?? [],
          }))}
          fields={cfFields.map((f) => ({ ...f, configJson: f.configJson ?? null }))}
        />
      )}

      {/* Task Create Modal */}
      <Dialog open={showCreateForm} onClose={() => setShowCreateForm(false)} title={taskT("createTask")} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <TaskForm projectId={project.id} onSubmit={handleCreateTask} onCancel={() => setShowCreateForm(false)} />
      </Dialog>

      {/* Custom Fields Modal */}
      <Dialog open={showCFModal} onClose={() => setShowCFModal(false)} title={t("customFields")} className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {cfLoading ? (
          <p className="text-sm text-fg-muted text-center py-8">{t("loading")}</p>
        ) : (
          <CustomFieldsManager projectId={project.id} initialFields={cfFields} />
        )}
      </Dialog>

      <MembersModal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        projectId={project.id}
        canAssignRoles={project.canAssignRoles}
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

      <ProjectSettingsModal
        open={showSettings}
        initial={settingsInitial}
        saving={settingsSaving}
        error={settingsError}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
        projectId={project.id}
      />
    </>
  );
});
