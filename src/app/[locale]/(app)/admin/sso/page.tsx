"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

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

export default function SsoPage() {
  const t = useTranslations("admin");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/v1/admin/sso");
        if (res.ok) {
          const json = await res.json();
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
        body: JSON.stringify({ saml }),
      });
    } finally {
      setSaving(false);
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
