"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { useFormattedDate } from "@/lib/date/useFormattedDate";

export type LdapSourceView = {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  bindUpn: string;
  bindPasswordConfigured: boolean;
  upnSuffix: string;
  searchBase: string;
  emailAttribute: string;
  nameAttribute: string;
  defaultRole: string;
  syncIntervalHours: number;
  tlsCaCert: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

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

export function LdapSourceList({ sources: initial }: { sources: LdapSourceView[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { dateTime } = useFormattedDate();

  const [sources, setSources] = useState<LdapSourceView[]>(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LdapSourceView | null>(null);
  const [form, setForm] = useState<SourceFormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<"test" | "sync" | "toggle" | null>(null);
  const [note, setNote] = useState("");

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setNote("");
    setDialogOpen(true);
  }

  function openEdit(source: LdapSourceView) {
    setEditing(source);
    setForm({
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
    });
    setError("");
    setNote("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setNote("");
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
        setSources((prev) => prev.map((s) => (s.id === editing.id ? json.data : s)));
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
        setSources((prev) => [...prev, json.data]);
      }
      setDialogOpen(false);
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(sourceId: string) {
    setBusyId(sourceId);
    setBusyKind("test");
    setNote("");
    try {
      const res = await apiFetch(`/api/v1/admin/ldap-sources/${sourceId}/test`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data?.ok) {
        setNote(t("ldapConnected"));
      } else {
        setNote(t("ldapConnectionFailed", { msg: json.data?.error ?? json.error?.message ?? "" }));
      }
    } catch {
      setNote(t("connectionTestFailed"));
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  }

  async function handleSync(sourceId: string) {
    setBusyId(sourceId);
    setBusyKind("sync");
    setNote("");
    try {
      const res = await apiFetch(`/api/v1/admin/ldap-sources/${sourceId}/sync`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setNote(t("ldapSyncDone", { users: json.data.users, groups: json.data.groups }));
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, lastSyncError: null, lastSyncedAt: new Date().toISOString() } : s)),
        );
      } else {
        setNote(t("ldapConnectionFailed", { msg: json.error?.message ?? "" }));
        setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, lastSyncError: json.error?.message ?? s.lastSyncError } : s)));
      }
    } catch {
      setNote(t("syncFailed"));
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  }

  async function handleToggle(source: LdapSourceView) {
    setBusyId(source.id);
    setBusyKind("toggle");
    try {
      const res = await apiFetch(`/api/v1/admin/ldap-sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSources((prev) => prev.map((s) => (s.id === source.id ? json.data : s)));
      }
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  }

  async function handleDelete(source: LdapSourceView) {
    if (!window.confirm(t("deleteSourceConfirm", { name: source.name }))) return;
    setBusyId(source.id);
    setBusyKind("toggle");
    try {
      const res = await apiFetch(`/api/v1/admin/ldap-sources/${source.id}`, { method: "DELETE" });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== source.id));
      }
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={openCreate}>{t("newSource")}</Button>
        {note && <span className="text-sm text-fg-secondary">{note}</span>}
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-fg-tertiary">{t("noSources")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-primary">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-fg-secondary">
              <tr>
                <th className="text-start ps-3 pe-2 py-2 font-medium">{t("name")}</th>
                <th className="text-start ps-2 pe-2 py-2 font-medium">{t("ldapHost")}</th>
                <th className="text-start ps-2 pe-2 py-2 font-medium">{t("status")}</th>
                <th className="text-start ps-2 pe-2 py-2 font-medium">{t("lastSynced")}</th>
                <th className="text-end ps-2 pe-3 py-2 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-bg-secondary/50">
                  <td className="ps-3 pe-2 py-2">
                    <div className="font-medium text-fg-primary">{source.name}</div>
                    <div className="text-xs text-fg-muted">{source.bindUpn}</div>
                    {source.lastSyncError && (
                      <div className="text-xs text-destructive mt-0.5" title={source.lastSyncError}>
                        {source.lastSyncError.slice(0, 80)}
                      </div>
                    )}
                  </td>
                  <td className="ps-2 pe-2 py-2 text-fg-secondary whitespace-nowrap">{source.url}</td>
                  <td className="ps-2 pe-2 py-2">
                    <button
                      type="button"
                      onClick={() => void handleToggle(source)}
                      disabled={busyId === source.id && busyKind === "toggle"}
                      aria-label={t(source.enabled ? "disableSourceAria" : "enableSourceAria", { name: source.name })}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors " +
                        (source.enabled
                          ? "bg-status-success/10 border-status-success/30 text-status-success"
                          : "bg-bg-surface-2 border-border-primary text-fg-muted")
                      }
                    >
                      <span className={"h-1.5 w-1.5 rounded-full " + (source.enabled ? "bg-status-success" : "bg-fg-muted")} />
                      {source.enabled ? t("enabled") : t("disabled")}
                    </button>
                  </td>
                  <td className="ps-2 pe-2 py-2 text-fg-secondary whitespace-nowrap">
                    {source.lastSyncedAt ? dateTime(source.lastSyncedAt) : tc("never")}
                  </td>
                  <td className="ps-2 pe-3 py-2 text-end">
                    <div className="inline-flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => void handleTest(source.id)} disabled={busyId === source.id}>
                        {busyId === source.id && busyKind === "test" ? t("ldapTesting") : t("ldapTestConnection")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleSync(source.id)} disabled={busyId === source.id}>
                        {busyId === source.id && busyKind === "sync" ? t("ldapSyncing") : t("ldapSyncNow")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(source)}>
                        {t("edit")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void handleDelete(source)} disabled={busyId === source.id}>
                        {t("delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
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
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tc("loading") : editing ? t("saveChanges") : t("createSource")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
