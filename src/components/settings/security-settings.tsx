"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";

type Props = {
  totpEnabled: boolean;
};

type EnrollResult = { secret: string; uri: string };
type VerifyResult = { enabled: true; recoveryCodes: string[] };

export function SecuritySettings({ totpEnabled: initialEnabled }: Props) {
  const t = useTranslations("settings.security");
  const tc = useTranslations("common");
  const { addToast } = useToast();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [phase, setPhase] = useState<"idle" | "enrolling" | "verifying" | "codes">(
    initialEnabled ? "idle" : "idle",
  );
  const [enroll, setEnroll] = useState<EnrollResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Render the otpauth:// URI as a QR image client-side (on-prem safe —
  // nothing leaves the browser; qrcode is a pure-JS encoder).
  useEffect(() => {
    let cancelled = false;
    if (phase === "enrolling" && enroll?.uri) {
      QRCode.toDataURL(enroll.uri, { width: 220, margin: 1, errorCorrectionLevel: "M" })
        .then((dataUrl) => {
          if (!cancelled) setQrDataUrl(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setQrDataUrl(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [phase, enroll]);

  async function handleEnable() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/auth/2fa", {
        method: "POST",
        body: JSON.stringify({ action: "enable" }),
      });
      if (res.ok) {
        const json = await res.json();
        setEnroll(json.data as EnrollResult);
        setPhase("enrolling");
      } else {
        addToast({ message: t("enableFailed") });
      }
    } catch {
      addToast({ message: t("enableFailed") });
    }
    setBusy(false);
  }

  async function handleVerify() {
    if (token.trim().length !== 6) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/auth/2fa", {
        method: "POST",
        body: JSON.stringify({ action: "verify", token: token.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data as VerifyResult;
        setEnabled(true);
        setPhase("codes");
        setRecoveryCodes(data.recoveryCodes);
      } else {
        addToast({ message: t("verifyFailed") });
        setToken("");
      }
    } catch {
      addToast({ message: t("verifyFailed") });
    }
    setBusy(false);
  }

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
        setEnroll(null);
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
        <button
          onClick={handleDisable}
          disabled={busy}
          className="px-4 py-2 text-sm font-medium rounded-md border border-danger/40 text-danger hover:bg-danger-bg disabled:opacity-50 transition-colors"
        >
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
        <div
          className="rounded-lg border border-border-primary bg-bg-primary p-4 font-mono text-sm text-fg-primary grid grid-cols-2 gap-2"
          data-testid="recovery-codes"
        >
          {recoveryCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyCodes}
            className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
          >
            {copied ? t("copied") : t("copyCodes")}
          </button>
          <button
            onClick={() => setPhase("idle")}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors"
          >
            {t("done")}
          </button>
        </div>
      </div>
    );
  }

  // Enrolling → show secret + code input.
  if (phase === "enrolling" && enroll) {
    return (
      <div className="space-y-4 max-w-lg">
        <p className="text-sm text-fg-muted">{t("enrollHint")}</p>
        <div className="flex flex-wrap items-start gap-4">
          {qrDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrDataUrl}
              alt={t("qrAlt")}
              width={220}
              height={220}
              className="rounded-lg border border-border-primary bg-white p-2"
              data-testid="totp-qr"
            />
          ) : (
            <div className="w-[220px] h-[220px] rounded-lg border border-border-primary bg-bg-primary flex items-center justify-center text-xs text-fg-muted">
              {t("qrFailed")}
            </div>
          )}
          <div className="flex-1 min-w-[16rem] space-y-3">
            <div className="rounded-lg border border-border-primary bg-bg-primary p-4">
              <p className="text-xs text-fg-muted mb-1">{t("secretLabel")}</p>
              <p className="font-mono text-sm break-all select-all" data-testid="totp-secret">
                {enroll.secret}
              </p>
              <p className="text-xs text-fg-muted mt-2">{t("secretHint")}</p>
            </div>
            <div>
              <label htmlFor="totp-token" className="block text-sm font-medium text-fg-secondary mb-1">
                {t("tokenLabel")}
              </label>
              <input
                id="totp-token"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg text-center tracking-[0.5em]"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleVerify}
            disabled={busy || token.length !== 6}
            className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy ? tc("loading") : t("verify")}
          </button>
          <button
            onClick={() => { setPhase("idle"); setEnroll(null); setToken(""); }}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  // Idle / not enabled.
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-fg-muted">{t("disabledHint")}</p>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {busy ? tc("loading") : t("enable")}
      </button>
    </div>
  );
}