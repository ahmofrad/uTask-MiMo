"use client";

import { memo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date/format";

type Entry = {
  id: string;
  minutes: number;
  billable: boolean;
  costRateMinorSnapshot: number;
  billRateMinorSnapshot: number | null;
  currencySnapshot: string;
  createdAt: string;
  project: { id: string; name: string };
  task: { id: string; title: string } | null;
};

type Period = {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  owner: { id: string; displayName: string; email: string };
  entries: Entry[];
};

type Project = { id: string; name: string };

type PeriodRowProps = {
  period: Period;
  projects: Project[];
  isApprover: boolean;
  currentUserId: string;
  expanded: boolean;
  onToggle: () => void;
  onTransition: (_periodId: string, _action: string) => Promise<void>;
  onAddEntry: (_periodId: string, _projectId: string, _minutes: number, _billable: boolean) => Promise<void>;
  busy: string | null;
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-accent-bg text-accent",
  submitted: "bg-warning-bg text-warning",
  approved: "bg-success-bg text-success",
  rejected: "bg-danger-bg text-danger",
  reopened: "bg-info-bg text-info",
};

const EDITABLE_STATUSES = ["open", "rejected", "reopened"];

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRate(minor: number, currency: string): string {
  const major = (minor / 100).toFixed(2);
  return `${currency} ${major}`;
}

export const PeriodRow = memo(function PeriodRow({
  period,
  projects,
  isApprover,
  currentUserId,
  expanded,
  onToggle,
  onTransition,
  onAddEntry,
  busy,
}: PeriodRowProps) {
  const t = useTranslations("timesheets");
  const locale = useLocale() as "fa-IR" | "en-US";
  const [entryProjectId, setEntryProjectId] = useState("");
  const [entryMinutes, setEntryMinutes] = useState("");
  const [entryBillable, setEntryBillable] = useState(true);

  const isOwner = period.owner.id === currentUserId;
  const isEditable = EDITABLE_STATUSES.includes(period.status);
  const totalMinutes = period.entries.reduce((sum, e) => sum + e.minutes, 0);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryProjectId || !entryMinutes) return;
    await onAddEntry(period.id, entryProjectId, Number(entryMinutes), entryBillable);
    setEntryProjectId("");
    setEntryMinutes("");
  }

  return (
    <div
      data-testid={`timesheet-period-${period.id}`}
      className="rounded-lg border border-border-primary overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between ps-4 pe-3 py-3 hover:bg-bg-surface transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[period.status] ?? ""}`}
          >
            {t(`status.${period.status}`)}
          </span>
          <span className="text-sm font-medium text-fg-primary">
            {period.owner.displayName}
          </span>
          <span className="text-xs text-fg-muted">
            {formatDate(new Date(period.periodStart), locale, "gregorian")} —{" "}
            {formatDate(new Date(period.periodEnd), locale, "gregorian")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-fg-secondary">
            {formatMinutes(totalMinutes)}
          </span>
          <span className="text-fg-muted">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-primary">
          {/* Time entries */}
          {period.entries.length > 0 ? (
            <div className="divide-y divide-border-primary">
              {period.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-fg-primary">{entry.project.name}</span>
                    {entry.task && (
                      <span className="text-fg-muted">· {entry.task.title}</span>
                    )}
                    {!entry.billable && (
                      <span className="text-xs text-fg-muted">({t("nonBillable")})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-fg-muted text-xs">
                      {t("costRate")}: {formatRate(entry.costRateMinorSnapshot, entry.currencySnapshot)}
                    </span>
                    {entry.billRateMinorSnapshot !== null && (
                      <span className="text-fg-muted text-xs">
                        {t("billRate")}: {formatRate(entry.billRateMinorSnapshot, entry.currencySnapshot)}
                      </span>
                    )}
                    <span className="tabular-nums font-medium">
                      {formatMinutes(entry.minutes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-fg-muted">{t("noEntries")}</p>
          )}

          {/* Add entry form (owner only, when editable) */}
          {isOwner && isEditable && (
            <form
              onSubmit={handleAddEntry}
              className="flex items-center gap-2 border-t border-border-primary px-4 py-3"
            >
              <select
                className="flex-1 rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                value={entryProjectId}
                onChange={(e) => setEntryProjectId(e.target.value)}
                required
              >
                <option value="">{t("selectProject")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                placeholder={t("minutes")}
                className="w-20 rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                value={entryMinutes}
                onChange={(e) => setEntryMinutes(e.target.value)}
                required
              />
              <label className="flex items-center gap-1 text-sm text-fg-secondary">
                <input
                  type="checkbox"
                  checked={entryBillable}
                  onChange={(e) => setEntryBillable(e.target.checked)}
                />
                {t("billable")}
              </label>
              <Button
                type="submit"
                size="sm"
                disabled={busy === `entry:${period.id}`}
              >
                {t("addEntry")}
              </Button>
            </form>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-t border-border-primary px-4 py-3">
            {isOwner && isEditable && (
              <Button
                size="sm"
                disabled={busy === `${period.id}:submit`}
                onClick={() => onTransition(period.id, "submit")}
              >
                {t("submit")}
              </Button>
            )}
            {isApprover && period.status === "submitted" && (
              <>
                <Button
                  size="sm"
                  disabled={busy === `${period.id}:approve`}
                  onClick={() => onTransition(period.id, "approve")}
                >
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === `${period.id}:reject`}
                  onClick={() => onTransition(period.id, "reject")}
                >
                  {t("reject")}
                </Button>
              </>
            )}
            {isApprover && period.status === "approved" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === `${period.id}:reopen`}
                onClick={() => onTransition(period.id, "reopen")}
              >
                {t("reopen")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});