"use client";

import { Board } from "@/components/task/board";
import { Timeline } from "@/components/task/timeline";
import { CalendarView } from "@/components/task/calendar-view";
import { GanttView } from "@/components/task/gantt-view";
import { WbsEditor } from "@/components/task/wbs-editor";
import { ProjectTaskList, type CustomFieldFilterDef } from "@/components/task/project-task-list";
import type { ProjectTab } from "./project-tabs";

export type TaskItem = {
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

export type ProjectCustomFieldDef = {
  id: string;
  name: string;
  key: string;
  type: string;
  required: boolean;
  configJson?: CustomFieldFilterDef["configJson"];
};

type Props = {
  activeTab: ProjectTab;
  projectId: string;
  tasks: TaskItem[];
  currentUserId: string | undefined;
  fields: ProjectCustomFieldDef[];
  onCalendarMove: (_taskId: string, _dueDate: string, _startDate: string | null) => Promise<void>;
};

export function ProjectTabContent({ activeTab, projectId, tasks, currentUserId, fields, onCalendarMove }: Props) {
  switch (activeTab) {
    case "board":
      return (
        <div>
          <Board initialTasks={tasks} projectId={projectId} currentUserId={currentUserId} />
        </div>
      );
    case "timeline":
      return (
        <div>
          <Timeline tasks={tasks} />
        </div>
      );    case "calendar":
      return (
        <div>
          <CalendarView tasks={tasks} onMove={onCalendarMove} />
        </div>
      );
    case "gantt":
      return (
        <div>
          <GanttView projectId={projectId} currentUserId={currentUserId} />
        </div>
      );
    case "wbs":
      return (
        <div>
          <WbsEditor projectId={projectId} showHeader={false} />
        </div>
      );
    case "tasks":
      return (
        <ProjectTaskList
          projectId={projectId}
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
          fields={fields.map((f) => ({ ...f, configJson: f.configJson ?? null }))}
        />
      );
    default:
      return null;
  }
}