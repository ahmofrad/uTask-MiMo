"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type LdapState = {
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

type SamlState = {
  enabled: boolean;
  entityId: string;
  acsUrl: string;
  sloUrl: string;
  idpMetadataUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificate: string;
  nameIdFormat: string;
  attributeMap: { email: string; displayName: string; role: string };
  defaultRole: string;
  adminRoleValue: string;
  wantAssertionsSigned: boolean;
  wantResponseSigned: boolean;
  signatureAlgorithm: string;
  digestAlgorithm: string;
};

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

function ldapPayload(ldap: LdapState) {
  return { ...ldap, searchBase: ldap.searchBase.trim() || undefined };
}

export default function SsoPage() {
  const t = useTranslations("admin");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [ldap, setLdap] = useState<LdapState>({
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
  });
  const [saml, setSaml] = useState<SamlState>({
    enabled: false,
    entityId: "",
    acsUrl: "",
    sloUrl: "",
    idpMetadataUrl: "",
    idpEntityId: "",
    idpSsoUrl: "",
    idpCertificate: "",
    nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    attributeMap: { email: "", displayName: "", role: "" },
    defaultRole: "member",
    adminRoleValue: "TaskApp.Admin",
    wantAssertionsSigned: true,
    wantResponseSigned: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
  });

  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/v1/admin/sso");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.ldap) setLdap((p) => ({ ...p, ...json.data.ldap }));
          if (json.data?.saml) setSaml((p) => ({ ...p, ...json.data.saml }));
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
        body: JSON.stringify({ ldap: ldapPayload(ldap), saml }),
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
        body: JSON.stringify({ ldap: ldapPayload(ldap) }),
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
              value={ldap.url}
              onChange={(e) => setLdap((p) => ({ ...p, url: e.target.value }))}
              placeholder="ldaps://dc.company.local:636"
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
          <Field label={t("searchBase")}>
            <input
              className={inputClass}
              value={ldap.searchBase}
              onChange={(e) => setLdap((p) => ({ ...p, searchBase: e.target.value }))}
              placeholder="DC=company,DC=local"
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
          <Field label={t("entityId")}>
            <input
              className={inputClass}
              value={saml.entityId}
              onChange={(e) => setSaml((p) => ({ ...p, entityId: e.target.value }))}
            />
          </Field>
          <Field label={t("acsUrl")}>
            <input
              className={inputClass}
              value={saml.acsUrl}
              onChange={(e) => setSaml((p) => ({ ...p, acsUrl: e.target.value }))}
            />
          </Field>
          <Field label={t("idpEntityId")}>
            <input
              className={inputClass}
              value={saml.idpEntityId}
              onChange={(e) => setSaml((p) => ({ ...p, idpEntityId: e.target.value }))}
            />
          </Field>
          <Field label={t("ssoUrl")}>
            <input
              className={inputClass}
              value={saml.idpSsoUrl}
              onChange={(e) => setSaml((p) => ({ ...p, idpSsoUrl: e.target.value }))}
            />
          </Field>
        </div>
        <Field label={t("certificate")}>
          <textarea
            value={saml.idpCertificate}
            onChange={(e) => setSaml((p) => ({ ...p, idpCertificate: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </Field>
      </SsoCard>
    </div>
  );
}
