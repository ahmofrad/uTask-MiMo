"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { WbsNode } from "@/lib/tasks";
import { AssigneeStack } from "@/components/task/assignee-stack";
import { PriorityBadge } from "@/components/task/priority-badge";
import { StatusBadge } from "@/components/task/status-badge";

export type DropZone = "before" | "after" | "child";

export type WbsRowProps = {
  node: WbsNode;
  busy: boolean;
  dropTarget: { id: string; zone: DropZone } | null;
  addingChildId: string | null;
  newChildTitle: string;
  onToggle: (_id: string) => void;
  onIndent: (_node: WbsNode) => void;
  onOutdent: (_node: WbsNode) => void;
  onBeginAddChild: (_parentId: string) => void;
  onAddChild: (_parentId: string, _title: string) => void;
  onCancelAddChild: () => void;
  onChildTitle: (_v: string) => void;
  onDragOver: (_node: WbsNode, _e: React.DragEvent) => void;
  onDrop: (_node: WbsNode, _e: React.DragEvent) => void;
  onDragEnd: () => void;
  onProgressChange: (_id: string, _value: number) => void;
  onProgressCommit: (_id: string, _value: number) => void;
  progressBusy: boolean;
  expanded: boolean;
};

export const WbsRow = memo(function WbsRow(props: WbsRowProps) {
  const t = useTranslations("task");
  const {
    node, busy, dropTarget, addingChildId, newChildTitle,
    onToggle, onIndent, onOutdent, onBeginAddChild, onAddChild, onCancelAddChild, onChildTitle,
    onDragOver, onDrop, onDragEnd, onProgressChange, onProgressCommit, progressBusy, expanded,
  } = props;

  const pct = node.isSummary ? node.rollupPercent : node.progress;
  const isDrop = dropTarget?.id === node.id;
  const dropClass = isDrop
    ? dropTarget?.zone === "before"
      ? "border-t-2 border-accent"
      : dropTarget?.zone === "after"
        ? "border-b-2 border-accent"
        : "bg-accent-bg"
    : "";
  const assignees = node.assigneeNames.map((displayName, index) => ({
    id: node.assigneeIds[index] ?? `${node.id}-assignee-${index}`,
    displayName,
  }));
  const status = node.status as "open" | "in_progress" | "done" | "cancelled";
  const priority = node.priority as "low" | "med" | "high" | "urgent";

  return (
    <div
      data-testid="wbs-row"
      data-task-id={node.id}
      data-depth={node.depth}
      className={`group border-t border-border transition-colors first:border-t-0 hover:bg-bg-surface-2 ${dropClass}`}
      onDragOver={(e) => onDragOver(node, e)}
      onDrop={(e) => onDrop(node, e)}
    >
      <div className="grid min-w-[60rem] grid-cols-12 items-center gap-3 px-3 py-2.5 text-sm">
        <div
          className="sticky start-0 z-10 col-span-5 flex min-w-0 items-center gap-2 bg-bg-surface group-hover:bg-bg-surface-2"
          style={{ paddingInlineStart: `${node.depth * 20}px` }}
        >
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", node.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={onDragEnd}
            className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-fg-subtle hover:bg-bg-primary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
            title={t("dragLabel")}
            aria-label={t("dragLabel")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              node.isSummary ? "cursor-pointer" : "invisible"
            }`}
            aria-label={expanded ? t("collapse") : t("expand")}
            disabled={!node.isSummary}
          >
            {node.isSummary && (
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          <span data-testid="wbs-code" className="w-12 shrink-0 font-mono text-xs text-fg-subtle">{node.wbsCode}</span>
          <Link
            href={`/tasks/${node.id}`}
            className="min-w-0 truncate font-medium text-fg-primary hover:text-accent"
          >
            {node.title}
          </Link>
          {node.isSummary && (
            <span className="shrink-0 rounded-full border border-border bg-bg-surface px-2 py-0.5 text-xs text-fg-muted" title={t("wbsSummary")}>
              {node.childCount}
            </span>
          )}
        </div>

        <div className="col-span-1">
          <StatusBadge status={status} />
        </div>
        <div className="col-span-1">
          <PriorityBadge priority={priority} />
        </div>
        <div className="col-span-2 min-w-0">
          {assignees.length > 0 ? (
            <AssigneeStack assignees={assignees} />
          ) : (
            <span className="text-xs text-fg-subtle">{t("unassigned")}</span>
          )}
        </div>

        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-surface-3" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-[width] ${node.isSummary ? "bg-accent" : "bg-success"}`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
          {!node.isSummary ? (
            <input
              data-testid="wbs-progress"
              type="range"
              min={0}
              max={100}
              value={node.progress}
              disabled={busy || progressBusy}
              onChange={(e) => onProgressChange(node.id, Number(e.target.value))}
              onPointerUp={(e) => onProgressCommit(node.id, Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                  onProgressCommit(node.id, Number((e.target as HTMLInputElement).value));
                }
              }}
              className="w-16 accent-accent"
              aria-label={t("wbsProgress")}
            />
          ) : (
            <span className="w-9 shrink-0 text-end text-xs text-fg-muted">{pct}%</span>
          )}
        </div>

        <div data-testid="wbs-row-actions" className="col-span-1 flex items-center justify-end gap-1">
          <button
            type="button"
            data-testid="wbs-indent"
            onClick={() => onIndent(node)}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={t("wbsIndent")}
            aria-label={t("wbsIndent")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-6-6 6-6m8 0v12" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="wbs-outdent"
            onClick={() => onOutdent(node)}
            disabled={busy || !node.parentTaskId}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={t("wbsOutdent")}
            aria-label={t("wbsOutdent")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l6-6-6-6m-8 0v12" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="wbs-add-child"
            onClick={() => onBeginAddChild(node.id)}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={t("wbsAddChild")}
            aria-label={t("wbsAddChild")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {addingChildId === node.id && (
        <form
          className="flex min-w-[60rem] items-center gap-2 border-t border-border bg-bg-surface-2 px-3 py-2"
          style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 12}px` }}
          onSubmit={(e) => {
            e.preventDefault();
            onAddChild(node.id, newChildTitle);
          }}
        >
          <input
            autoFocus
            value={newChildTitle}
            onChange={(e) => onChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelAddChild();
            }}
            placeholder={t("wbsAddChildPlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-fg-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button type="submit" disabled={busy || !newChildTitle.trim()} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
            {t("add")}
          </button>
          <button type="button" onClick={onCancelAddChild} className="rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-bg-primary">
            {t("wbsCancel")}
          </button>
        </form>
      )}
    </div>
  );
});