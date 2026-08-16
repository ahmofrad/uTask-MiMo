"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type TemplateValues = {
  invite_subject: string;
  invite_text: string;
  invite_html: string;
  reset_subject: string;
  reset_text: string;
  reset_html: string;
};

const EMPTY: TemplateValues = {
  invite_subject: "",
  invite_text: "",
  invite_html: "",
  reset_subject: "",
  reset_text: "",
  reset_html: "",
};

export default function EmailTemplatesPage() {
  const t = useTranslations("emailTemplates");
  const tCommon = useTranslations("common");

  const [values, setValues] = useState<TemplateValues>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/admin/settings/email-templates")
      .then((r) => r.json())
      .then((j) => {
        const data = j.data as Partial<TemplateValues> | undefined;
        if (data) setValues((v) => ({ ...v, ...data }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setMsg(res.ok ? { ok: true, text: t("saved") } : { ok: false, text: t("saveFailed") });
    } catch {
      setMsg({ ok: false, text: t("networkError") });
    }
    setSaving(false);
  }

  const inputClass =
    "w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent";

  function section(title: string, prefix: "invite" | "reset") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-fg-primary">{title}</h2>
        <div>
          <label htmlFor={`${prefix}_subject`} className="block text-sm font-medium text-fg-secondary mb-1">{t("subject")}</label>
          <input
            id={`${prefix}_subject`}
            value={values[`${prefix}_subject`]}
            onChange={(e) => setValues((v) => ({ ...v, [`${prefix}_subject`]: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}_text`} className="block text-sm font-medium text-fg-secondary mb-1">{t("textBody")}</label>
          <textarea
            id={`${prefix}_text`}
            rows={6}
            value={values[`${prefix}_text`]}
            onChange={(e) => setValues((v) => ({ ...v, [`${prefix}_text`]: e.target.value }))}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}_html`} className="block text-sm font-medium text-fg-secondary mb-1">{t("htmlBody")}</label>
          <textarea
            id={`${prefix}_html`}
            rows={6}
            value={values[`${prefix}_html`]}
            onChange={(e) => setValues((v) => ({ ...v, [`${prefix}_html`]: e.target.value }))}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
      <p className="text-sm text-fg-tertiary max-w-2xl">{t("description")}</p>
      <p className="text-sm text-fg-tertiary max-w-2xl bg-bg-surface border border-border-primary rounded-lg px-4 py-3">
        {t("placeholdersHint")}
      </p>

      {!loaded ? (
        <p className="text-sm text-fg-tertiary">{t("loading")}</p>
      ) : (
        <div className="max-w-2xl space-y-8">
          {section(t("inviteSection"), "invite")}
          {section(t("resetSection"), "reset")}

          <div className="flex items-center gap-4">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t("saving") : tCommon("save")}
            </button>
            {msg && (
              <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
