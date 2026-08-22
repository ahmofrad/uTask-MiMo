"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/date/format";

type Period = {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  owner: { id: string; displayName: string; email: string };
  entries: Array<{
    id: string;
    minutes: number;
    billable: boolean;
    costRateMinorSnapshot: number;
    currencySnapshot: string;
    createdAt: string;
    project: { id: string; name: string };
    task: { id: string; title: string } | null;
  }>;
};

type Project = { id: string; name: string };

type TimesheetViewProps = {
  departmentId: string;
  periods: Period[];
  projects: Project[];
  isApprover: boolean;
  currentUserId: string;
};

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRate(minor: number, currency: string): string {
  const major = (minor / 100).toFixed(2);
  return `${currency} ${major}`;
}

const STATUS_TONE: Record<string, string> = {
  open: "bg-accent-bg text-accent",
  submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  reopened: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function TimesheetView({
  departmentId,
  periods,
  projects,
  isApprover,
  currentUserId,
}: TimesheetViewProps) {
  const t = useTranslations("timesheets");
  const locale = useLocale() as "fa-IR" | "en-US";
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);

  // New entry form state
  const [entryForm, setEntryForm] = useState({
    periodId: "",
    projectId: "",
    minutes: "",
    billable: true,
  });

  // New period form state
  const [periodForm, setPeriodForm] = useState({
    periodStart: "",
    periodEnd: "",
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleTransition(periodId: string, action: string) {
    setBusy(`${periodId}:${action}`);
    try {
      const res = await apiFetch(
        `/api/v1/departments/${departmentId}/timesheets/periods/${periodId}/${action}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("actionFailed") });
        return;
      }
      addToast({ message: t(`${action}Success`) });
      // Reload to reflect the new status
      window.location.reload();
    } catch {
      addToast({ message: t("actionFailed") });
    } finally {
      setBusy(null);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryForm.periodId || !entryForm.projectId || !entryForm.minutes) return;
    setBusy(`entry:${entryForm.periodId}`);
    try {
      const res = await apiFetch(
        `/api/v1/departments/${departmentId}/timesheets/periods/${entryForm.periodId}/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: entryForm.projectId,
            minutes: Number(entryForm.minutes),
            billable: entryForm.billable,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("entryFailed") });
        return;
      }
      addToast({ message: t("entryAdded") });
      setEntryForm({ ...entryForm, projectId: "", minutes: "" });
      window.location.reload();
    } catch {
      addToast({ message: t("entryFailed") });
    } finally {
      setBusy(null);
    }
  }

  async function handleCreatePeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!periodForm.periodStart || !periodForm.periodEnd) return;
    setBusy("period:create");
    try {
      const res = await apiFetch(
        `/api/v1/departments/${departmentId}/timesheets/periods`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodStart: periodForm.periodStart,
            periodEnd: periodForm.periodEnd,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("periodFailed") });
        return;
      }
      addToast({ message: t("periodCreated") });
      setPeriodForm({ periodStart: "", periodEnd: "" });
      setShowCreatePeriod(false);
      window.location.reload();
    } catch {
      addToast({ message: t("periodFailed") });
    } finally {
      setBusy(null);
    }
  }

  if (periods.length === 0 && !showCreatePeriod) {
    return (
      <div className="rounded-lg border border-border-primary p-8 text-center text-fg-muted">
        <p className="mb-4">{t("noPeriods")}</p>
        <Button size="sm" onClick={() => setShowCreatePeriod(true)}>
          {t("createPeriod")}
        </Button>
      </div>
    );
  }

  const editableStatuses = ["open", "rejected", "reopened"];

  return (
    <div className="space-y-4">
      {/* Create period toggle */}
      <div>
        {showCreatePeriod ? (
          <form
            onSubmit={handleCreatePeriod}
            className="flex items-end gap-2 rounded-lg border border-border-primary p-4"
          >
            <label className="flex flex-col gap-1 text-sm text-fg-secondary">
              {t("periodStart")}
              <input
                type="date"
                className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                value={periodForm.periodStart}
                onChange={(e) => setPeriodForm({ ...periodForm, periodStart: e.target.value })}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-fg-secondary">
              {t("periodEnd")}
              <input
                type="date"
                className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                value={periodForm.periodEnd}
                onChange={(e) => setPeriodForm({ ...periodForm, periodEnd: e.target.value })}
                required
              />
            </label>
            <Button type="submit" size="sm" disabled={busy === "period:create"}>
              {t("createPeriod")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowCreatePeriod(false)}
            >
              {t("cancel")}
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowCreatePeriod(true)}>
            {t("createPeriod")}
          </Button>
        )}
      </div>

      {periods.map((period) => {
        const isOwner = period.owner.id === currentUserId;
        const isEditable = editableStatuses.includes(period.status);
        const isOpen = expanded.has(period.id);
        const totalMinutes = period.entries.reduce((sum, e) => sum + e.minutes, 0);

        return (
          <div key={period.id} className="rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => toggle(period.id)}
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
                <span className="text-fg-muted">{isOpen ? "−" : "+"}</span>
              </div>
            </button>

            {isOpen && (
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
                            {formatRate(entry.costRateMinorSnapshot, entry.currencySnapshot)}
                          </span>
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
                    <input type="hidden" name="periodId" value={period.id} />
                    <input type="hidden" name="departmentId" value={departmentId} />
                    <select
                      className="flex-1 rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                      value={entryForm.periodId === period.id ? entryForm.projectId : ""}
                      onChange={(e) =>
                        setEntryForm({ ...entryForm, periodId: period.id, projectId: e.target.value })
                      }
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
                      value={entryForm.periodId === period.id ? entryForm.minutes : ""}
                      onChange={(e) =>
                        setEntryForm({ ...entryForm, periodId: period.id, minutes: e.target.value })
                      }
                      required
                    />
                    <label className="flex items-center gap-1 text-sm text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={entryForm.billable}
                        onChange={(e) =>
                          setEntryForm({ ...entryForm, periodId: period.id, billable: e.target.checked })
                        }
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
                      onClick={() => handleTransition(period.id, "submit")}
                    >
                      {t("submit")}
                    </Button>
                  )}
                  {isApprover && period.status === "submitted" && (
                    <>
                      <Button
                        size="sm"
                        disabled={busy === `${period.id}:approve`}
                        onClick={() => handleTransition(period.id, "approve")}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === `${period.id}:reject`}
                        onClick={() => handleTransition(period.id, "reject")}
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
                      onClick={() => handleTransition(period.id, "reopen")}
                    >
                      {t("reopen")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
