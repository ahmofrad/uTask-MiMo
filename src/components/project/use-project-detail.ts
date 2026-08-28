"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { ProjectCustomFieldDef, TaskItem } from "./project-tab-content";
import type { ProjectTab } from "./project-tabs";

export type ProjectInfo = {
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

export type UseProjectDetailOptions = {
  project: ProjectInfo;
  initialTasks: TaskItem[];
};

export type UseProjectDetailReturn = {
  ragStatus: "GREEN" | "AMBER" | "RED";
  ragReason: string | null;
  setRagStatus: (s: "GREEN" | "AMBER" | "RED") => void;
  setRagReason: (r: string | null) => void;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  showCreateForm: boolean;
  setShowCreateForm: (v: boolean) => void;
  showCFModal: boolean;
  setShowCFModal: (v: boolean) => void;
  showTagsModal: boolean;
  setShowTagsModal: (v: boolean) => void;
  showMembersModal: boolean;
  setShowMembersModal: (v: boolean) => void;
  projectTags: { id: string; name: string; color?: string | null }[];
  cfFields: ProjectCustomFieldDef[];
  cfLoading: boolean;
  name: string;
  desc: string;
  canEdit: boolean;
  canManage: boolean;
  activeTab: ProjectTab;
  setActiveTab: (tab: ProjectTab) => void;
  saveName: (val: string) => Promise<void>;
  saveDesc: (val: string | null) => Promise<void>;
  openCFModal: () => Promise<void>;
  handleCreateTask: (data: Record<string, unknown>) => Promise<void>;
  handleCalendarMove: (taskId: string, dueDate: string, startDate: string | null) => Promise<void>;
  refreshTags: () => Promise<void>;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  settingsSaving: boolean;
  settingsError: string | null;
  setSettingsError: (e: string | null) => void;
  saveSettings: (values: { status: "active" | "archived"; visibility: string; color: string }) => Promise<void>;
  settingsInitial: { status: "active" | "archived"; visibility: string; color: string };
};

export function useProjectDetail({ project, initialTasks }: UseProjectDetailOptions): UseProjectDetailReturn {
  const [ragStatus, setRagStatus] = useState<"GREEN" | "AMBER" | "RED">(project.ragStatus);
  const [ragReason, setRagReason] = useState<string | null>(project.ragReason);
  const [tasks, setTasks] = useState(initialTasks);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCFModal, setShowCFModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [projectTags, setProjectTags] = useState<{ id: string; name: string; color?: string | null }[]>([]);
  const [cfFields, setCfFields] = useState<ProjectCustomFieldDef[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("board");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const canEdit = project.isOwner;
  const canManage = project.canManage;

  const settingsInitial = useMemo(
    () => ({
      status: (project.status ?? "active") as "active" | "archived",
      visibility: project.visibility ?? "private",
      color: project.color ?? "#4f46e5",
    }),
    [project.status, project.visibility, project.color],
  );

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
        setSettingsError(json?.error?.message ?? "Failed to save settings");
      } else {
        setShowSettings(false);
      }
    } catch {
      setSettingsError("Failed to save settings");
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

  return {
    ragStatus,
    ragReason,
    setRagStatus,
    setRagReason,
    tasks,
    setTasks,
    showCreateForm,
    setShowCreateForm,
    showCFModal,
    setShowCFModal,
    showTagsModal,
    setShowTagsModal,
    showMembersModal,
    setShowMembersModal,
    projectTags,
    cfFields,
    cfLoading,
    name,
    desc,
    canEdit,
    canManage,
    activeTab,
    setActiveTab,
    saveName,
    saveDesc,
    openCFModal,
    handleCreateTask,
    handleCalendarMove,
    refreshTags,
    showSettings,
    setShowSettings,
    settingsSaving,
    settingsError,
    setSettingsError,
    saveSettings,
    settingsInitial,
  };
}
