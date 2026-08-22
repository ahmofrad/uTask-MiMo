"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import { CreatePeriodForm } from "@/components/timesheet/timesheet-create-period-form";
import { PeriodRow } from "@/components/timesheet/timesheet-period-row";

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

export function TimesheetView({
  departmentId,
  periods,
  projects,
  isApprover,
  currentUserId,
}: TimesheetViewProps) {
  const t = useTranslations("timesheets");
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);

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
      window.location.reload();
    } catch {
      addToast({ message: t("actionFailed") });
    } finally {
      setBusy(null);
    }
  }

  async function handleAddEntry(periodId: string, projectId: string, minutes: number, billable: boolean) {
    setBusy(`entry:${periodId}`);
    try {
      const res = await apiFetch(
        `/api/v1/departments/${departmentId}/timesheets/periods/${periodId}/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, minutes, billable }),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("entryFailed") });
        return;
      }
      addToast({ message: t("entryAdded") });
      window.location.reload();
    } catch {
      addToast({ message: t("entryFailed") });
    } finally {
      setBusy(null);
    }
  }

  async function handleCreatePeriod(periodStart: string, periodEnd: string) {
    setBusy("period:create");
    try {
      const res = await apiFetch(
        `/api/v1/departments/${departmentId}/timesheets/periods`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodStart, periodEnd }),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("periodFailed") });
        return;
      }
      addToast({ message: t("periodCreated") });
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

  return (
    <div className="space-y-4">
      {/* Create period toggle */}
      <div>
        {showCreatePeriod ? (
          <CreatePeriodForm
            onSubmit={handleCreatePeriod}
            onCancel={() => setShowCreatePeriod(false)}
            busy={busy === "period:create"}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowCreatePeriod(true)}>
            {t("createPeriod")}
          </Button>
        )}
      </div>

      {periods.map((period) => (
        <PeriodRow
          key={period.id}
          period={period}
          projects={projects}
          isApprover={isApprover}
          currentUserId={currentUserId}
          expanded={expanded.has(period.id)}
          onToggle={() => toggle(period.id)}
          onTransition={handleTransition}
          onAddEntry={handleAddEntry}
          busy={busy}
        />
      ))}
    </div>
  );
}