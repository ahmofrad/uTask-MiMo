"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { LdapSourceFormDialog } from "@/components/admin/ldap-source-form-dialog";
import { LdapSourceTable } from "@/components/admin/ldap-source-table";

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

export function LdapSourceList({ sources: initial }: { sources: LdapSourceView[] }) {
  const t = useTranslations("admin");

  const [sources, setSources] = useState<LdapSourceView[]>(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LdapSourceView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<"test" | "sync" | "toggle" | null>(null);
  const [note, setNote] = useState("");

  function openCreate() {
    setEditing(null);
    setNote("");
    setDialogOpen(true);
  }

  function openEdit(source: LdapSourceView) {
    setEditing(source);
    setNote("");
    setDialogOpen(true);
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

      <LdapSourceTable
        sources={sources}
        busyId={busyId}
        busyKind={busyKind}
        onTest={handleTest}
        onSync={handleSync}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />

      <LdapSourceFormDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onCreated={(source) => setSources((prev) => [...prev, source])}
        onUpdated={(source) => setSources((prev) => prev.map((s) => (s.id === source.id ? source : s)))}
      />
    </div>
  );
}