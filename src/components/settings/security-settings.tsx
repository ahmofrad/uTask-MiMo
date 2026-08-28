"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";
import { TotpEnrollForm } from "./totp-enroll-form";

type Props = {
  totpEnabled: boolean;
};

export function SecuritySettings({ totpEnabled: initialEnabled }: Props) {
  const t = useTranslations("settings.security");
  const tc = useTranslations("common");
  const { addToast } = useToast();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [phase, setPhase] = useState<"idle" | "enrolling" | "codes">("idle");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDisable() {
    if (!window.confirm(t("disableConfirm"))) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/auth/2fa", {
        method: "POST",
        body: JSON.stringify({ action: "disable" }),
      });
      if (res.ok) {
        setEnabled(false);
        setPhase("idle");
        setRecoveryCodes([]);
        addToast({ message: t("disabled") });
      } else {
        addToast({ message: t("disableFailed") });
      }
    } catch {
      addToast({ message: t("disableFailed") });
    }
    setBusy(false);
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Enabled → show status + disable.
  if (enabled && phase !== "codes") {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
          {t("enabled")}
        </div>
        <p className="text-sm text-fg-muted">{t("enabledHint")}</p>
        <button onClick={handleDisable} disabled={busy}
          className="px-4 py-2 text-sm font-medium rounded-md border border-danger/40 text-danger hover:bg-danger-bg disabled:opacity-50 transition-colors">
          {busy ? tc("loading") : t("disable")}
        </button>
      </div>
    );
  }

  // Recovery codes shown once, right after verification.
  if (phase === "codes") {
    return (
      <div className="space-y-4 max-w-lg">
        <p className="text-sm text-fg-primary font-medium">{t("codesTitle")}</p>
        <p className="text-sm text-fg-muted">{t("codesHint")}</p>
        <div className="rounded-lg border border-border-primary bg-bg-primary p-4 font-mono text-sm text-fg-primary grid grid-cols-2 gap-2" data-testid="recovery-codes">
          {recoveryCodes.map((code) => (<span key={code}>{code}</span>))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyCodes} className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity">
            {copied ? t("copied") : t("copyCodes")}
          </button>
          <button onClick={() => setPhase("idle")} className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors">
            {t("done")}
          </button>
        </div>
      </div>
    );
  }

  // Enrolling → show QR + code input.
  if (phase === "enrolling") {
    return (
      <TotpEnrollForm
        onComplete={(codes) => { setEnabled(true); setPhase("codes"); setRecoveryCodes(codes); }}
        onCancel={() => setPhase("idle")}
      />
    );
  }

  // Idle / not enabled.
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-fg-muted">{t("disabledHint")}</p>
      <button onClick={() => setPhase("enrolling")} disabled={busy}
        className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity">
        {busy ? tc("loading") : t("enable")}
      </button>
    </div>
  );
}
