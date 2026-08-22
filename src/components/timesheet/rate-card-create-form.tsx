"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type CreateFormData = {
  scope: "user" | "role";
  userId: string;
  roleType: "owner" | "admin" | "manager" | "member" | "guest";
  costRateMinor: string;
  billRateMinor: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
};

type User = { id: string; displayName: string; email: string };

type CreateFormProps = {
  users: User[];
  busy: boolean;
  onSubmit: (_data: CreateFormData) => Promise<void>;
  onCancel: () => void;
};

export const RateCardCreateForm = memo(function RateCardCreateForm({ users, busy, onSubmit, onCancel }: CreateFormProps) {
  const t = useTranslations("timesheets");
  const [form, setForm] = useState<CreateFormData>({
    scope: "user",
    userId: "",
    roleType: "member",
    costRateMinor: "",
    billRateMinor: "",
    currency: "USD",
    effectiveFrom: "",
    effectiveTo: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form);
    setForm({
      scope: "user",
      userId: "",
      roleType: "member",
      costRateMinor: "",
      billRateMinor: "",
      currency: "USD",
      effectiveFrom: "",
      effectiveTo: "",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border-primary p-4">
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          {t("scope")}
          <select
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as "user" | "role" })}
          >
            <option value="user">{t("user")}</option>
            <option value="role">{t("role")}</option>
          </select>
        </label>
        {form.scope === "user" ? (
          <label className="flex flex-col gap-1 text-sm text-fg-secondary">
            {t("user")}
            <select
              className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              required
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-fg-secondary">
            {t("role")}
            <select
              className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
              value={form.roleType}
              onChange={(e) =>
                setForm({ ...form, roleType: e.target.value as typeof form.roleType })
              }
              required
            >
              <option value="owner">{t("roles.owner")}</option>
              <option value="admin">{t("roles.admin")}</option>
              <option value="manager">{t("roles.manager")}</option>
              <option value="member">{t("roles.member")}</option>
              <option value="guest">{t("roles.guest")}</option>
            </select>
          </label>
        )}
      </div>
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          {t("costRateMinor")}
          <input
            type="number"
            min="0"
            step="1"
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
            value={form.costRateMinor}
            onChange={(e) => setForm({ ...form, costRateMinor: e.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          {t("billRateMinor")}
          <input
            type="number"
            min="0"
            step="1"
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
            value={form.billRateMinor}
            onChange={(e) => setForm({ ...form, billRateMinor: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          {t("currency")}
          <input
            type="text"
            maxLength={3}
            className="w-16 rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            required
          />
        </label>
      </div>
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          {t("effectiveFrom")}
          <input
            type="date"
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          {t("effectiveTo")}
          <input
            type="date"
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
            value={form.effectiveTo}
            onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {t("createRateCard")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
});