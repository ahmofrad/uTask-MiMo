"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { renderMarkdown } from "@/lib/markdown/render";

type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "med" | "high" | "urgent";

type TaskDetailHeaderCardProps = {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectName: string;
  onSaveTitle: (_title: string) => void;
  onSaveDescription: (_description: string | null) => void;
  onStatusChange: (_status: TaskStatus) => void;
  onPriorityChange: (_priority: TaskPriority) => void;
};

export function TaskDetailHeaderCard({
  title,
  description,
  status,
  priority,
  projectName,
  onSaveTitle,
  onSaveDescription,
  onStatusChange,
  onPriorityChange,
}: TaskDetailHeaderCardProps) {
  const t = useTranslations();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState(description ?? "");
  const renderedDescription = useMemo(
    () => (description ? renderMarkdown(description) : ""),
    [description],
  );

  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
      {/* Title */}
      <div>
        {editingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            className="w-full text-2xl font-bold bg-transparent border-b-2 border-accent text-fg outline-none"
            autoFocus
            onBlur={() => onSaveTitle(titleDraft.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveTitle(titleDraft.trim());
              if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(title); }
            }}
          />
        ) : (
          <h1
            className="text-2xl font-bold text-fg cursor-pointer hover:text-accent transition-colors rounded-lg p-1 -m-1 hover:bg-bg-surface-2"
            onClick={() => { setEditingTitle(true); setTitleDraft(title); }}
          >
            {title}
          </h1>
        )}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
          className="text-sm bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-fg"
        >
          <option value="open">{t("task.status.open")}</option>
          <option value="in_progress">{t("task.status.in_progress")}</option>
          <option value="done">{t("task.status.done")}</option>
          <option value="cancelled">{t("task.status.cancelled")}</option>
        </select>
        <select
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value as TaskPriority)}
          className="text-sm bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-fg"
        >
          <option value="low">{t("task.priority.low")}</option>
          <option value="med">{t("task.priority.med")}</option>
          <option value="high">{t("task.priority.high")}</option>
          <option value="urgent">{t("task.priority.urgent")}</option>
        </select>
        <span className="text-xs text-fg-muted bg-bg-secondary px-2.5 py-1 rounded-lg">
          {projectName}
        </span>
      </div>

      {/* Description */}
      <div className="pt-2 border-t border-border-secondary">
        <h3 className="text-xs font-medium text-fg-muted mb-2 uppercase tracking-wide">{t("task.fields.description")}</h3>
        {editingDescription ? (
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => onSaveDescription(descDraft.trim() || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSaveDescription(descDraft.trim() || null); }
              if (e.key === "Escape") { setEditingDescription(false); setDescDraft(description ?? ""); }
            }}
            rows={4}
            className="w-full text-sm bg-transparent border border-accent rounded-lg p-2 text-fg outline-none resize-none"
            autoFocus
            placeholder={t("task.fields.description")}
          />
        ) : (
          <div
            className="text-sm text-fg-secondary cursor-pointer hover:text-accent transition-colors min-h-[2rem] rounded-lg p-1 -m-1 hover:bg-bg-surface-2"
            onClick={() => { setEditingDescription(true); setDescDraft(description ?? ""); }}
          >
            {description ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderedDescription }} />
            ) : (
              <span className="text-fg-subtle italic">{t("task.fields.description")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
