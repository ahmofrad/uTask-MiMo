"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type ProjectHeaderTag = {
  id: string;
  name: string;
  color?: string | null;
};

export type RagStatus = "GREEN" | "AMBER" | "RED";

type ProjectHeaderProps = {
  project: {
    id: string;
    color?: string | null;
    ownerName: string;
    taskCount: number;
    memberCount: number;
    ragStatus: RagStatus;
    ragReason: string | null;
  };
  name: string;
  desc: string;
  canEdit: boolean;
  canManage: boolean;
  projectTags: ProjectHeaderTag[];
  onSaveName: (_name: string) => Promise<void>;
  onSaveDesc: (_desc: string | null) => Promise<void>;
  onOpenSettings: () => void;
  onOpenCF: () => void;
  onOpenTags: () => void;
  onOpenMembers: () => void;
  onSaveHealth: (_status: RagStatus, _reason: string | null) => Promise<Response>;
};

const RAG_DOT: Record<RagStatus, string> = {
  GREEN: "bg-success",
  AMBER: "bg-warning",
  RED: "bg-destructive",
};

const RAG_BADGE: Record<RagStatus, string> = {
  GREEN: "bg-success-bg text-success border-success/40",
  AMBER: "bg-warning-bg text-warning border-warning/40",
  RED: "bg-destructive-bg text-destructive border-destructive/40",
};

export function ProjectDetailHeader({
  project,
  name,
  desc,
  canEdit,
  canManage,
  projectTags,
  onSaveName,
  onSaveDesc,
  onOpenSettings,
  onOpenCF,
  onOpenTags,
  onOpenMembers,
  onSaveHealth,
}: ProjectHeaderProps) {
  const t = useTranslations("project");
  const tRag = useTranslations("rag");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(desc);
  const [editingHealth, setEditingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<RagStatus>(project.ragStatus);
  const [healthReason, setHealthReason] = useState(project.ragReason ?? "");
  const [savingHealth, setSavingHealth] = useState(false);

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {project.color && (
            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          )}
          {editingName ? (
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => { setEditingName(false); onSaveName(nameDraft.trim()); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setEditingName(false); onSaveName(nameDraft.trim()); }
                if (e.key === "Escape") { setEditingName(false); setNameDraft(name); }
              }}
              autoFocus
              className="text-xl font-bold bg-transparent border-b-2 border-accent text-fg-primary outline-none min-w-0 flex-1"
            />
          ) : (
            <h1
              className={`text-xl font-bold text-fg-primary truncate ${
                canEdit ? "cursor-pointer hover:text-accent transition-colors rounded-lg p-1 -m-1 hover:bg-bg-surface-2" : ""
              }`}
              onClick={() => canEdit && setEditingName(true)}
            >
              {name}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
              title={t("settings.title")}
              aria-label={t("settings.title")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={onOpenCF}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
          >
            {t("customFields")}
          </button>
          <button
            type="button"
            onClick={onOpenTags}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
          >
            {t("tags")}
          </button>
        </div>
      </div>
      {editingDesc ? (
        <textarea
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={() => { setEditingDesc(false); onSaveDesc(descDraft.trim() || null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              setEditingDesc(false);
              onSaveDesc(descDraft.trim() || null);
            }
            if (e.key === "Escape") {
              setEditingDesc(false);
              setDescDraft(desc);
            }
          }}
          rows={3}
          autoFocus
          placeholder={t("fields.description")}
          className="w-full text-sm bg-transparent border border-accent rounded-lg p-2 text-fg-primary outline-none resize-none mb-4"
        />
      ) : (
        <div
          className={`text-sm text-fg-muted mb-4 rounded-lg p-1 -m-1 ${
            canEdit ? "cursor-pointer hover:text-accent transition-colors hover:bg-bg-surface-2" : ""
          }`}
          onClick={() => canEdit && setEditingDesc(true)}
        >
          {desc ? (
            desc
          ) : (
            <span className="text-fg-subtle italic">{t("fields.description")}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-fg-subtle">
        <span>{t("owner")}: {project.ownerName}</span>
        <span>{t("tasksCount", { count: project.taskCount })}</span>
        <button onClick={onOpenMembers} className="hover:text-accent transition-colors underline underline-offset-2">
          {t("membersCount", { count: project.memberCount })}
        </button>
        <button
          type="button"
          data-testid="project-rag-badge"
          title={project.ragReason || undefined}
          onClick={() => {
            if (!canManage) return;
            setHealthStatus(project.ragStatus);
            setHealthReason(project.ragReason ?? "");
            setEditingHealth(true);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${RAG_BADGE[project.ragStatus]} ${canManage ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${RAG_DOT[project.ragStatus]}`} />
          {tRag(project.ragStatus.toLowerCase())}
        </button>
      </div>
      {editingHealth && canManage && (
        <div
          data-testid="project-rag-editor"
          className="mt-3 flex flex-wrap items-center gap-2 border border-border-primary rounded-lg bg-bg-surface-2 p-3"
        >
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">
            {tRag("status")}
            <select
              data-testid="project-rag-status"
              value={healthStatus}
              onChange={(e) => setHealthStatus(e.target.value as RagStatus)}
              className="px-2 py-1.5 border border-border-primary rounded-md bg-bg-primary text-sm text-fg-primary"
            >
              <option value="GREEN">{tRag("green")}</option>
              <option value="AMBER">{tRag("amber")}</option>
              <option value="RED">{tRag("red")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-secondary flex-1 min-w-48">
            {tRag("reason")}
            <input
              type="text"
              data-testid="project-rag-reason"
              value={healthReason}
              maxLength={500}
              onChange={(e) => setHealthReason(e.target.value)}
              placeholder={tRag("reasonPlaceholder")}
              className="px-2 py-1.5 border border-border-primary rounded-md bg-bg-primary text-sm text-fg-primary placeholder:text-fg-tertiary"
            />
          </label>
          <button
            type="button"
            data-testid="project-rag-save"
            disabled={savingHealth}
            onClick={async () => {
              setSavingHealth(true);
              try {
                await onSaveHealth(healthStatus, healthReason.trim() || null);
                setEditingHealth(false);
              } finally {
                setSavingHealth(false);
              }
            }}
            className="px-3 py-1.5 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {savingHealth ? tRag("saving") : tRag("save")}
          </button>
          <button
            type="button"
            data-testid="project-rag-cancel"
            onClick={() => setEditingHealth(false)}
            className="px-3 py-1.5 border border-border-primary rounded-md text-sm text-fg-secondary hover:bg-bg-surface"
          >
            {tRag("cancel")}
          </button>
        </div>
      )}
      {projectTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {projectTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border"
              style={{ backgroundColor: tag.color ? `${tag.color}22` : undefined, borderColor: tag.color ?? undefined, color: tag.color ?? "inherit" }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
