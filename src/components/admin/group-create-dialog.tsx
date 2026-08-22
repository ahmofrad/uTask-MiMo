"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";

type Department = { id: string; name: string };
type SyncGroup = {
  id: string;
  name: string;
  source: "manual" | "ldap";
  dn: string | null;
  memberCount: number;
  department: { id: string; name: string } | null;
  ownerDepartment: Department | null;
  ownerDepartmentId: string | null;
  lastSyncedAt: string | null;
};

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent";

type Props = {
  open: boolean;
  departments: Department[];
  onClose: () => void;
  onCreated: (_group: SyncGroup) => void;
};

export const GroupCreateDialog = memo(function GroupCreateDialog({
  open,
  departments,
  onClose,
  onCreated,
}: Props) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [ownerDept, setOwnerDept] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), ownerDepartmentId: ownerDept || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error?.message ?? t("createFailed"));
        return;
      }
      onCreated(json.data);
      setName("");
      setOwnerDept("");
      onClose();
    } catch {
      setError(t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-fg-primary">{t("newGroup")}</h3>
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("groupName")} *
          </label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("ownerDepartment")}
          </label>
          <select
            className={inputClass}
            value={ownerDept}
            onChange={(e) => setOwnerDept(e.target.value)}
          >
            <option value="">{t("noOwnerDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? tc("loading") : t("createGroup")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
});