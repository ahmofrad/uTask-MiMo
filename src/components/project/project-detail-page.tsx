"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { TagsModal } from "@/components/tags/tags-modal";
import { TaskForm } from "@/components/task/task-form";
import { CustomFieldsManager } from "@/components/custom-field/custom-fields-manager";
import { MembersModal } from "@/components/project/members-modal";
import { ProjectDetailHeader } from "@/components/project/project-detail-header";
import { ProjectSettingsModal } from "@/components/project/project-settings-modal";
import { ProjectDepartmentLinks } from "@/components/project/project-department-links";
import { ProjectTabs } from "@/components/project/project-tabs";
import { ProjectTabContent } from "@/components/project/project-tab-content";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { useProjectDetail, type ProjectInfo } from "./use-project-detail";
import type { TaskItem } from "./project-tab-content";

type ProjectDetailPageProps = {
  project: ProjectInfo;
  initialTasks: TaskItem[];
  currentUserId: string | undefined;
};

export const ProjectDetailPage = memo(function ProjectDetailPage({ project, initialTasks, currentUserId }: ProjectDetailPageProps) {
  const t = useTranslations("project");
  const taskT = useTranslations("task");

  const {
    ragStatus, ragReason, setRagStatus, setRagReason,
    tasks, setTasks,
    showCreateForm, setShowCreateForm,
    showCFModal, setShowCFModal,
    showTagsModal, setShowTagsModal,
    showMembersModal, setShowMembersModal,
    projectTags, cfFields, cfLoading,
    name, desc, canEdit, canManage,
    activeTab, setActiveTab,
    saveName, saveDesc, openCFModal,
    handleCreateTask, handleCalendarMove, refreshTags,
    showSettings, setShowSettings, settingsSaving, settingsError, setSettingsError, saveSettings, settingsInitial,
  } = useProjectDetail({ project, initialTasks });

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
        onOpenSettings={() => { setSettingsError(null); setShowSettings(true); }}
        onOpenCF={() => void openCFModal()}
        onOpenTags={() => setShowTagsModal(true)}
        onOpenMembers={() => setShowMembersModal(true)}
        onSaveHealth={async (status, reason) => {
          const res = await apiFetch(`/api/v1/projects/${project.id}/health`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ragStatus: status, ragReason: reason }),
          });
          if (res.ok) { setRagStatus(status); setRagReason(reason); }
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

      <Dialog open={showCreateForm} onClose={() => setShowCreateForm(false)} title={taskT("createTask")} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <TaskForm projectId={project.id} onSubmit={handleCreateTask} onCancel={() => setShowCreateForm(false)} />
      </Dialog>

      <Dialog open={showCFModal} onClose={() => setShowCFModal(false)} title={t("customFields")} className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {cfLoading ? (
          <p className="text-sm text-fg-muted text-center py-8">{t("loading")}</p>
        ) : (
          <CustomFieldsManager projectId={project.id} initialFields={cfFields} />
        )}
      </Dialog>

      <MembersModal open={showMembersModal} onClose={() => setShowMembersModal(false)} projectId={project.id} canAssignRoles={project.canAssignRoles} />
      <TagsModal projectId={project.id} open={showTagsModal} onClose={() => setShowTagsModal(false)} onChanged={() => void refreshTags()} />

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
