"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

function SsoCard({ title, children }: { title: string } & React.PropsWithChildren) {
  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
      <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", readOnly = false }: { label: string; value: string; onChange?: (_v: string) => void; type?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

export default function SsoPage() {
  const t = useTranslations("admin");
  const [saving, setSaving] = useState(false);
  const [ldap, setLdap] = useState({
    enabled: false,
    serverUrl: "",
    bindDn: "",
    bindPassword: "",
    searchBase: "",
    searchFilter: "(uid={{username}})",
  });
  const [saml, setSaml] = useState({
    enabled: false,
    entityId: "",
    ssoUrl: "",
    certificate: "",
  });

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/v1/admin/sso", {
        method: "PATCH",
        body: JSON.stringify({ ldap, saml }),
      });
    } finally {
      setSaving(false);
    }
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
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={ldap.enabled}
            onChange={(e) => setLdap((p) => ({ ...p, enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-fg-primary">{t("enableLdap")}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t("serverUrl")} value={ldap.serverUrl} onChange={(v) => setLdap((p) => ({ ...p, serverUrl: v }))} />
          <Input label={t("bindDn")} value={ldap.bindDn} onChange={(v) => setLdap((p) => ({ ...p, bindDn: v }))} />
          <Input label={t("bindPassword")} value={ldap.bindPassword} type="password" onChange={(v) => setLdap((p) => ({ ...p, bindPassword: v }))} />
          <Input label={t("searchBase")} value={ldap.searchBase} onChange={(v) => setLdap((p) => ({ ...p, searchBase: v }))} />
          <Input label={t("searchFilter")} value={ldap.searchFilter} onChange={(v) => setLdap((p) => ({ ...p, searchFilter: v }))} />
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
          <Input label={t("idpEntityId")} value={saml.entityId} onChange={(v) => setSaml((p) => ({ ...p, entityId: v }))} />
          <Input label={t("ssoUrl")} value={saml.ssoUrl} onChange={(v) => setSaml((p) => ({ ...p, ssoUrl: v }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">{t("certificate")}</label>
          <textarea
            value={saml.certificate}
            onChange={(e) => setSaml((p) => ({ ...p, certificate: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>
      </SsoCard>
    </div>
  );
}
