"use client";

import { memo, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import type { LdapSourceView } from "@/components/admin/ldap-source-list";

type SourceFormState = {
  name: string;
  enabled: boolean;
  url: string;
  bindUpn: string;
  bindPassword: string;
  upnSuffix: string;
  searchBase: string;
  emailAttribute: string;
  nameAttribute: string;
  defaultRole: string;
  syncIntervalHours: number;
  tlsCaCert: string;
};

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent";

function emptyForm(): SourceFormState {
  return {
    name: "",
    enabled: false,
    url: "",
    bindUpn: "",
    bindPassword: "",
    upnSuffix: "",
    searchBase: "",
    emailAttribute: "mail",
    nameAttribute: "cn",
    defaultRole: "member",
    syncIntervalHours: 12,
    tlsCaCert: "",
  };
}

function formFromSource(source: LdapSourceView): SourceFormState {
  return {
    name: source.name,
    enabled: source.enabled,
    url: source.url,
    bindUpn: source.bindUpn,
    bindPassword: "",
    upnSuffix: source.upnSuffix ?? "",
    searchBase: source.searchBase ?? "",
    emailAttribute: source.emailAttribute,
    nameAttribute: source.nameAttribute,
    defaultRole: source.defaultRole,
    syncIntervalHours: source.syncIntervalHours,
    tlsCaCert: source.tlsCaCert ?? "",
  };
}

type LdapSourceFormDialogProps = {
  open: boolean;
  editing: LdapSourceView | null;
  onClose: () => void;
  onCreated: (_source: LdapSourceView) => void;
  onUpdated: (_source: LdapSourceView) => void;
};

export const LdapSourceFormDialog = memo(function LdapSourceFormDialog({
  open,
  editing,
  onClose,
  onCreated,
  onUpdated,
}: LdapSourceFormDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [form, setForm] = useState<SourceFormState>(editing ? formFromSource(editing) : emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset form when editing target changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      setForm(editing ? formFromSource(editing) : emptyForm());
      setError("");
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        enabled: form.enabled,
        url: form.url.trim(),
        bindUpn: form.bindUpn.trim(),
        ...(form.bindPassword ? { bindPassword: form.bindPassword } : {}),
        upnSuffix: form.upnSuffix.trim(),
        searchBase: form.searchBase.trim(),
        emailAttribute: form.emailAttribute.trim(),
        nameAttribute: form.nameAttribute.trim(),
        defaultRole: form.defaultRole.trim(),
        syncIntervalHours: form.syncIntervalHours,
        tlsCaCert: form.tlsCaCert.trim(),
      };

      if (editing) {
        const res = await apiFetch(`/api/v1/admin/ldap-sources/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error?.message ?? t("saveFailed"));
          return;
        }
        onUpdated(json.data);
      } else {
        const res = await apiFetch("/api/v1/admin/ldap-sources", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error?.message ?? t("saveFailed"));
          return;
        }
        onCreated(json.data);
      }
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-fg-primary">
          {editing ? t("editSource") : t("newSource")}
        </h3>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("sourceName")} *</label>
          <input className={inputClass} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required autoFocus />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-fg-primary">{t("enableSource")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("ldapHost")} *</label>
            <input className={inputClass} value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="ldaps://dc.company.local:636" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("ldapBindUpn")} *</label>
            <input className={inputClass} value={form.bindUpn} onChange={(e) => setForm((p) => ({ ...p, bindUpn: e.target.value }))} placeholder="svc-ldap@company.local" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">
              {t("bindPassword")}{editing && <span className="text-fg-muted"> · {t("passwordHint")}</span>}
            </label>
            <input type="password" className={inputClass} value={form.bindPassword} onChange={(e) => setForm((p) => ({ ...p, bindPassword: e.target.value }))} placeholder={editing ? "••••••••" : ""} required={!editing} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("ldapUpnSuffix")}</label>
            <input className={inputClass} value={form.upnSuffix} onChange={(e) => setForm((p) => ({ ...p, upnSuffix: e.target.value }))} placeholder="company.local" />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("searchBase")}</label>
            <input className={inputClass} value={form.searchBase} onChange={(e) => setForm((p) => ({ ...p, searchBase: e.target.value }))} placeholder="DC=company,DC=local" />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("ldapSyncInterval")}</label>
            <input type="number" min={1} max={744} className={inputClass} value={form.syncIntervalHours} onChange={(e) => setForm((p) => ({ ...p, syncIntervalHours: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("emailAttribute")}</label>
            <input className={inputClass} value={form.emailAttribute} onChange={(e) => setForm((p) => ({ ...p, emailAttribute: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("nameAttribute")}</label>
            <input className={inputClass} value={form.nameAttribute} onChange={(e) => setForm((p) => ({ ...p, nameAttribute: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("defaultRole")}</label>
            <input className={inputClass} value={form.defaultRole} onChange={(e) => setForm((p) => ({ ...p, defaultRole: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("tlsCaCert")}</label>
            <input className={inputClass} value={form.tlsCaCert} onChange={(e) => setForm((p) => ({ ...p, tlsCaCert: e.target.value }))} placeholder="-----BEGIN CERTIFICATE-----" />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? tc("loading") : editing ? t("saveChanges") : t("createSource")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
});