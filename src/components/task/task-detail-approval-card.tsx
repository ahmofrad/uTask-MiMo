"use client";

import { useTranslations } from "next-intl";

type Member = { id: string; displayName: string; avatarUrl?: string | null };

type Props = {
  requiresApproval: boolean;
  approverId: string | null;
  projectMembers: Member[];
  onRequiresApprovalChange: (_value: boolean) => void;
  onApproverChange: (_userId: string | null) => void;
};

export function TaskApprovalCard({
  requiresApproval,
  approverId,
  projectMembers,
  onRequiresApprovalChange,
  onApproverChange,
}: Props) {
  const t = useTranslations();

  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
      <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
        {t("approval.title")}
      </h4>
      <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
        <input
          type="checkbox"
          checked={requiresApproval}
          onChange={(e) => onRequiresApprovalChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        {t("approval.requiresApproval")}
      </label>
      {requiresApproval && (
        <div>
          <label className="text-xs text-fg-muted block mb-1">{t("approval.approver")}</label>
          <select
            value={approverId ?? ""}
            onChange={(e) => onApproverChange(e.target.value || null)}
            className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
          >
            <option value="">{t("approval.anyFinalizer")}</option>
            {projectMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}