"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type LdapState = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  bindUpn: string;
  bindPassword: string;
  upnSuffix: string;
  syncIntervalHours: number;
};

type SamlState = {
  enabled: boolean;
  entityId: string;
  ssoUrl: string;
  certificate: string;
};

type SyncGroup = { id: string; dn: string; name: string };
type Suggestion = { dn: string; name: string };

function SsoCard({ title, children }: { title: string } & React.PropsWithChildren) {
  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
      <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string } & React.PropsWithChildren) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function SsoPage() {
  const t = useTranslations("admin");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [ldap, setLdap] = useState<LdapState>({
    enabled: false,
    host: "",
    port: 389,
    secure: false,
    bindUpn: "",
    bindPassword: "",
    upnSuffix: "",
    syncIntervalHours: 12,
  });
  const [saml, setSaml] = useState<SamlState>({
    enabled: false,
    entityId: "",
    ssoUrl: "",
    certificate: "",
  });

  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [groups, setGroups] = useState<SyncGroup[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/v1/admin/sso");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.ldap) setLdap((p) => ({ ...p, ...json.data.ldap }));
          if (json.data?.saml) setSaml((p) => ({ ...p, ...json.data.saml }));
        }
        const g = await apiFetch("/api/v1/admin/ldap/groups");
        if (g.ok) {
          const j = await g.json();
          setGroups(j.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/v1/admin/sso", {
        method: "PATCH",
        body: JSON.stringify({ ldap, saml }),
      });
      setTestState("idle");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestState("testing");
    setTestMsg("");
    try {
      const res = await apiFetch("/api/v1/admin/ldap/test", {
        method: "POST",
        body: JSON.stringify({ ldap }),
      });
      const json = await res.json();
      if (res.ok && json.data?.ok) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestMsg(json?.data?.error ?? json?.error?.message ?? "error");
      }
    } catch {
      setTestState("error");
      setTestMsg("request failed");
    }
  }

  async function handleSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/v1/admin/ldap/groups?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setSuggestions(json.data ?? []);
      }
    } catch {
      setSuggestions([]);
    }
  }

  async function handleAddGroup(g: Suggestion) {
    try {
      const res = await apiFetch("/api/v1/admin/ldap/groups", {
        method: "POST",
        body: JSON.stringify({ dn: g.dn, name: g.name }),
      });
      if (res.ok) {
        const json = await res.json();
        setGroups((prev) => [json.data, ...prev.filter((x) => x.dn !== g.dn)]);
        setSearch("");
        setSuggestions([]);
      }
    } catch {
      /* ignore */
    }
  }

  async function handleRemoveGroup(id: string) {
    try {
      const res = await apiFetch(`/api/v1/admin/ldap/groups/${id}`, { method: "DELETE" });
      if (res.ok) setGroups((prev) => prev.filter((x) => x.id !== id));
    } catch {
      /* ignore */
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await apiFetch("/api/v1/admin/ldap/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSyncMsg(t("ldapSyncDone", { users: json.data.users, groups: json.data.groups }));
      } else {
        setSyncMsg(json?.error?.message ?? "sync failed");
      }
    } catch {
      setSyncMsg("sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-fg-muted">…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("ssoConfig")}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? t("saving") : t("saveConfig")}
        </button>
      </div>

      <SsoCard title="LDAP">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ldap.enabled}
            onChange={(e) => setLdap((p) => ({ ...p, enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-fg-primary">{t("enableLdap")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("ldapHost")}>
            <input
              className={inputClass}
              value={ldap.host}
              onChange={(e) => setLdap((p) => ({ ...p, host: e.target.value }))}
              placeholder="ldap://dc.company.local"
            />
          </Field>
          <Field label={t("ldapPort")}>
            <input
              type="number"
              className={inputClass}
              value={ldap.port}
              onChange={(e) => setLdap((p) => ({ ...p, port: Number(e.target.value) }))}
            />
          </Field>
          <Field label={t("ldapBindUpn")}>
            <input
              className={inputClass}
              value={ldap.bindUpn}
              onChange={(e) => setLdap((p) => ({ ...p, bindUpn: e.target.value }))}
              placeholder="svc-ldap@company.local"
            />
          </Field>
          <Field label={t("bindPassword")}>
            <input
              type="password"
              className={inputClass}
              value={ldap.bindPassword}
              onChange={(e) => setLdap((p) => ({ ...p, bindPassword: e.target.value }))}
            />
          </Field>
          <Field label={t("ldapUpnSuffix")}>
            <input
              className={inputClass}
              value={ldap.upnSuffix}
              onChange={(e) => setLdap((p) => ({ ...p, upnSuffix: e.target.value }))}
              placeholder="company.local"
            />
          </Field>
          <Field label={t("ldapSyncInterval")}>
            <input
              type="number"
              className={inputClass}
              value={ldap.syncIntervalHours}
              onChange={(e) => setLdap((p) => ({ ...p, syncIntervalHours: Number(e.target.value) }))}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-fg-primary">
          <input
            type="checkbox"
            checked={ldap.secure}
            onChange={(e) => setLdap((p) => ({ ...p, secure: e.target.checked }))}
            className="rounded"
          />
          {t("ldapSecure")}
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testState === "testing"}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-border-primary bg-bg-primary text-fg-primary hover:bg-bg-surface disabled:opacity-50"
          >
            {testState === "testing" ? t("ldapTesting") : t("ldapTestConnection")}
          </button>
          {testState === "ok" && <span className="text-sm text-status-success">{t("ldapConnected")}</span>}
          {testState === "error" && (
            <span className="text-sm text-status-danger">{t("ldapConnectionFailed", { msg: testMsg })}</span>
          )}
        </div>

        <div className="pt-2 border-t border-border-primary space-y-3">
          <div className="text-sm font-medium text-fg-primary">{t("ldapGroups")}</div>

          <div className="relative">
            <input
              className={inputClass}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("ldapSearchGroups")}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border-primary bg-bg-primary shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.dn}>
                    <button
                      type="button"
                      onClick={() => handleAddGroup(s)}
                      className="w-full text-start px-3 py-2 text-sm text-fg-primary hover:bg-bg-surface"
                    >
                      <span className="block">{s.name}</span>
                      <span className="block text-xs text-fg-muted">{s.dn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {ldap.host && !suggestions.length && search && (
            <p className="text-xs text-fg-muted">{t("ldapSaveFirst")}</p>
          )}

          {groups.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("ldapNoGroups")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-surface border border-border-primary text-sm text-fg-primary"
                >
                  {g.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveGroup(g.id)}
                    className="text-fg-muted hover:text-status-danger"
                    aria-label={t("delete")}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50"
            >
              {syncing ? t("ldapSyncing") : t("ldapSyncNow")}
            </button>
            {syncMsg && <span className="text-sm text-fg-muted">{syncMsg}</span>}
          </div>
        </div>
      </SsoCard>

      <SsoCard title="SAML 2.0">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={saml.enabled}
            onChange={(e) => setSaml((p) => ({ ...p, enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-fg-primary">{t("enableSaml")}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("idpEntityId")}>
            <input
              className={inputClass}
              value={saml.entityId}
              onChange={(e) => setSaml((p) => ({ ...p, entityId: e.target.value }))}
            />
          </Field>
          <Field label={t("ssoUrl")}>
            <input
              className={inputClass}
              value={saml.ssoUrl}
              onChange={(e) => setSaml((p) => ({ ...p, ssoUrl: e.target.value }))}
            />
          </Field>
        </div>
        <Field label={t("certificate")}>
          <textarea
            value={saml.certificate}
            onChange={(e) => setSaml((p) => ({ ...p, certificate: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </Field>
      </SsoCard>
    </div>
  );
}
