"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { TagsModal } from "@/components/tags/tags-modal";
import { TaskForm } from "@/components/task/task-form";
import { CustomFieldsManager } from "@/components/custom-field/custom-fields-manager";
import { MembersModal } from "@/components/project/members-modal";
import { ProjectDetailHeader } from "@/components/project/project-detail-header";
import { ProjectSettingsModal } from "@/components/project/project-settings-modal";
import { ProjectDepartmentLinks } from "@/components/project/project-department-links";
import { ProjectTabs, type ProjectTab } from "@/components/project/project-tabs";
import { ProjectTabContent, type ProjectCustomFieldDef, type TaskItem } from "@/components/project/project-tab-content";
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

type ProjectDetailPageProps = {
  project: ProjectInfo;
  initialTasks: TaskItem[];
  currentUserId: string | undefined;
};

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
  const [cfFields, setCfFields] = useState<ProjectCustomFieldDef[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTab>("board");

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

  const refreshTags = async () => {
    try {
      const res = await apiFetch(`/api/v1/tags?projectId=${project.id}`);
      if (res.ok) {
        setProjectTags((await res.json()).data ?? []);
      }
    } catch {
      // ignore
    }
  };

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

      <ProjectTabs
        activeTab={activeTab}
        canCreate={canManage}
        onCreate={() => setShowCreateForm(true)}
        onTabChange={setActiveTab}
      />

      <ProjectTabContent
        activeTab={activeTab}
        projectId={project.id}
        tasks={tasks}
        currentUserId={currentUserId}
        fields={cfFields}
        onCalendarMove={(taskId, dueDate, startDate) => handleCalendarMove(taskId, dueDate, startDate)}
      />

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
        onChanged={() => void refreshTags()}
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