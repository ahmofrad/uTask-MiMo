"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { WbsNode } from "@/lib/tasks";
import { computeWbsStats } from "@/lib/tasks/wbs-stats";
import { WbsRow } from "@/components/task/wbs-row";
import { WbsToolbar } from "@/components/task/wbs-toolbar";
import { WbsAddRootForm } from "@/components/task/wbs-add-root-form";
import { useWbsEditor } from "@/components/task/use-wbs-editor";

type EditorProps = {
  projectId: string;
  projectName?: string;
  showHeader?: boolean;
};

export const WbsEditor = memo(function WbsEditor({ projectId, projectName, showHeader = true }: EditorProps) {
  const t = useTranslations("task");
  const ed = useWbsEditor(projectId);

  const visibleNodes = ed.nodes.filter((node) => !ed.isHidden(node));
  const stats = computeWbsStats(ed.nodes, (id) => ed.nodeById.get(id)?.isSummary === true);

  if (ed.loading) {
    return (
      <div data-testid="wbs-loading" className="py-10 text-center text-sm text-fg-muted">
        {t("loading")}
      </div>
    );
  }

  return (
    <div data-testid="wbs-editor" className="space-y-5">
      {showHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {projectName && (
              <Link href={`/projects/${projectId}`} className="mb-2 inline-flex text-sm text-fg-muted hover:text-accent">
                {t("backToProject")}
              </Link>
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-fg-primary">{t("wbsTitle")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("wbsDescription")}</p>
          </div>
        </div>
      )}

      {ed.error && (
        <div className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {ed.error}
        </div>
      )}

      <WbsToolbar
        search={ed.search}
        onSearch={ed.setSearch}
        onExpandAll={() => ed.setExpanded(new Set(ed.nodes.filter((node) => node.isSummary).map((node) => node.id)))}
        onCollapseAll={() => ed.setExpanded(new Set())}
        onAddRoot={() => {
          ed.setAddingRoot(true);
          ed.setRootTitle("");
        }}
      />

      {ed.addingRoot && (
        <WbsAddRootForm
          busy={ed.busyId === "root"}
          title={ed.rootTitle}
          onTitle={ed.setRootTitle}
          onSubmit={() => void ed.addRoot()}
          onCancel={() => {
            ed.setAddingRoot(false);
            ed.setRootTitle("");
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("wbsStatItems"), value: ed.nodes.length },
          { label: t("wbsStatGroups"), value: ed.nodes.filter((node) => node.isSummary).length },
          { label: t("wbsStatCompleted"), value: `${stats.completedCount}/${stats.leafCount}` },
          { label: t("wbsStatProgress"), value: `${stats.averageProgress}%` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-bg-surface px-4 py-3">
            <div className="text-lg font-semibold text-fg-primary">{stat.value}</div>
            <div className="mt-0.5 text-xs text-fg-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface shadow-xs">
        <div className="min-w-[60rem]">
          <div data-testid="wbs-column-header" className="grid grid-cols-12 gap-3 border-b border-border bg-bg-surface-2 px-3 py-2 text-xs font-medium text-fg-muted">
            <span className="sticky start-0 z-20 col-span-5 bg-bg-surface-2">{t("wbsColumnTask")}</span>
            <span className="col-span-1">{t("wbsColumnStatus")}</span>
            <span className="col-span-1">{t("wbsColumnPriority")}</span>
            <span className="col-span-2">{t("wbsColumnOwner")}</span>
            <span className="col-span-2">{t("wbsColumnProgress")}</span>
            <span className="col-span-1 text-end">{t("wbsColumnActions")}</span>
          </div>
          {visibleNodes.length > 0
            ? visibleNodes.map((node) => (
                <WbsRow
                  key={node.id}
                  node={node}
                  busy={ed.busyId === node.id}
                  dropTarget={ed.dropTarget}
                  addingChildId={ed.addingChildId}
                  newChildTitle={ed.newChildTitle}
                  onToggle={ed.toggle}
                  onIndent={ed.indent}
                  onOutdent={ed.outdent}
                  onBeginAddChild={ed.beginAddChild}
                  onAddChild={ed.addChild}
                  onCancelAddChild={() => {
                    ed.setAddingChildId?.(null);
                    ed.setNewChildTitle("");
                  }}
                  onChildTitle={ed.setNewChildTitle}
                  onDragOver={ed.onDragOver}
                  onDrop={ed.onDrop}
                  onDragEnd={() => ed.setDropTarget(null)}
                  onProgressChange={ed.onProgressChange}
                  onProgressCommit={ed.onProgressCommit}
                  progressBusy={ed.progressSavingId === node.id}
                  expanded={ed.expanded.has(node.id)}
                />
              ))
            : (
              <div data-testid="wbs-no-results" className="px-4 py-12 text-center text-sm text-fg-muted">
                {ed.search.trim() ? t("wbsNoResults") : t("wbsEmpty")}
              </div>
            )}
        </div>
      </div>
    </div>
  );
});
