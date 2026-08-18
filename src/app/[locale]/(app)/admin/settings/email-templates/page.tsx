"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { DEFAULT_MAIL_TEMPLATES, renderTemplate, MAIL_PREVIEW_VARS } from "@/lib/mail/templates";

type TemplateValues = {
  invite_subject: string;
  invite_text: string;
  invite_html: string;
  reset_subject: string;
  reset_text: string;
  reset_html: string;
};

type SectionKey = "invite" | "reset";

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
  const [previewFor, setPreviewFor] = useState<SectionKey | null>(null);
  const [testFor, setTestFor] = useState<SectionKey | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  async function sendTest(prefix: SectionKey) {
    if (!testTo.trim() || testSending) return;
    setTestSending(true);
    setTestMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: prefix, to: testTo.trim() }),
      });
      if (res.status === 400) {
        setTestMsg({ ok: false, text: t("testSmtpUnconfigured") });
      } else if (res.ok) {
        setTestMsg({ ok: true, text: t("testSent", { to: testTo.trim() }) });
      } else {
        setTestMsg({ ok: false, text: t("testFailed") });
      }
    } catch {
      setTestMsg({ ok: false, text: t("networkError") });
    }
    setTestSending(false);
  }

  /** Effective HTML for a section: a blank override falls back to the default, exactly like getMailTemplates. */
  function effectiveHtml(prefix: SectionKey): string {
    const custom = values[`${prefix}_html`].trim();
    if (custom) return custom;
    return DEFAULT_MAIL_TEMPLATES[prefix === "invite" ? "invite" : "passwordReset"].html;
  }

  function effectiveSubject(prefix: SectionKey): string {
    const custom = values[`${prefix}_subject`].trim();
    if (custom) return custom;
    return DEFAULT_MAIL_TEMPLATES[prefix === "invite" ? "invite" : "passwordReset"].subject;
  }

  function section(title: string, prefix: SectionKey) {
    const previewOpen = previewFor === prefix;
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
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={`${prefix}_html`} className="block text-sm font-medium text-fg-secondary">{t("htmlBody")}</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPreviewFor(previewOpen ? null : prefix);
                  setTestFor(null);
                }}
                className="text-sm font-medium text-accent hover:underline"
              >
                {previewOpen ? t("hidePreview") : t("preview")}
              </button>
              <button
                type="button"
                data-testid={`test-send-${prefix}`}
                onClick={() => {
                  setTestFor(testFor === prefix ? null : prefix);
                  setPreviewFor(null);
                  setTestMsg(null);
                }}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("testSend")}
              </button>
            </div>
          </div>
          <textarea
            id={`${prefix}_html`}
            rows={6}
            value={values[`${prefix}_html`]}
            onChange={(e) => setValues((v) => ({ ...v, [`${prefix}_html`]: e.target.value }))}
            className={`${inputClass} font-mono text-xs`}
          />              {previewOpen && (
            <div className="mt-2">
              <p className="text-xs text-fg-tertiary mb-2">{t("previewUsesSample")}</p>
              <div className="rounded-md border border-border-primary overflow-hidden">
                <div className="px-4 py-2 border-b border-border-primary bg-bg-surface text-sm font-medium text-fg-primary truncate">
                  {renderTemplate(effectiveSubject(prefix), MAIL_PREVIEW_VARS)}
                </div>
                <iframe
                  title={t("preview")}
                  sandbox=""
                  className="w-full h-72 bg-bg-surface"
                  srcDoc={`<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;color:#1a1a1a;font-family:-apple-system,Segoe UI,Roboto,sans-serif">${renderTemplate(effectiveHtml(prefix), MAIL_PREVIEW_VARS)}</body></html>`}
                />
              </div>
            </div>
          )}
          {testFor === prefix && (
            <div data-testid={`test-send-form-${prefix}`} className="mt-2 rounded-md border border-border-primary bg-bg-surface p-3">
              <p className="text-xs text-fg-tertiary mb-2">{t("previewUsesSample")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder={t("testRecipient")}
                  className="w-64 px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  data-testid={`test-send-submit-${prefix}`}
                  onClick={() => void sendTest(prefix)}
                  disabled={testSending || !testTo.trim()}
                  className="px-3 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {testSending ? tCommon("loading") : t("testSendSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setTestFor(null)}
                  className="px-3 py-2 border border-border-primary rounded-md text-sm text-fg-secondary hover:bg-bg-surface-2"
                >
                  {tCommon("cancel")}
                </button>
              </div>
              {testMsg && (
                <p data-testid={`test-send-msg-${prefix}`} className={`mt-2 text-sm ${testMsg.ok ? "text-success" : "text-destructive"}`}>
                  {testMsg.text}
                </p>
              )}
            </div>
          )}
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
