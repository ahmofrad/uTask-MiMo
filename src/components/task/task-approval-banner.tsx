"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type TaskApprovalBannerProps = {
  canApprove: boolean;
  approverName?: string | null;
  onApprove: () => Promise<void> | void;
  onReject: (_reason: string) => Promise<void> | void;
};

export function TaskApprovalBanner({
  canApprove,
  approverName,
  onApprove,
  onReject,
}: TaskApprovalBannerProps) {
  const t = useTranslations();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submitApprove() {
    setError(null);
    try {
      await onApprove();
    } catch {
      setError(t("approval.decisionFailed"));
    }
  }

  async function submitReject() {
    if (!reason.trim()) {
      setError(t("approval.reasonRequired"));
      return;
    }
    setError(null);
    try {
      await onReject(reason.trim());
    } catch {
      setError(t("approval.decisionFailed"));
    }
  }

  return (
    <div
      className="border border-tone-violet/30 bg-tone-violet-bg rounded-xl p-4"
      data-testid="task-approval-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-primary">{t("approval.awaitingApproval")}</p>
          {approverName && (
            <p className="text-xs text-fg-muted mt-0.5">
              {t("approval.approver")}: {approverName}
            </p>
          )}
        </div>
        {canApprove && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void submitApprove()}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
            >
              {t("approval.approve")}
            </button>
            {rejecting ? (
              <>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("approval.rejectionReason")}
                  className="text-sm bg-bg-primary border border-border rounded-md px-2 py-1.5 text-fg min-w-[12rem]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitReject();
                    if (e.key === "Escape") {
                      setRejecting(false);
                      setReason("");
                      setError(null);
                    }
                  }}
                />
                <button
                  onClick={() => void submitReject()}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-destructive text-fg-inverse hover:opacity-90 transition-opacity"
                >
                  {t("approval.reject")}
                </button>
                <button
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                    setError(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md border border-border text-fg-muted hover:text-fg transition-colors",
                  )}
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                onClick={() => setRejecting(true)}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-border text-fg-muted hover:text-fg transition-colors"
              >
                {t("approval.reject")}
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}
