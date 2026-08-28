"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type EnrollResult = { secret: string; uri: string };
type VerifyResult = { enabled: true; recoveryCodes: string[] };

type TotpEnrollFormProps = {
  onComplete: (recoveryCodes: string[]) => void;
  onCancel: () => void;
};

export function TotpEnrollForm({ onComplete, onCancel }: TotpEnrollFormProps) {
  const t = useTranslations("settings.security");
  const tc = useTranslations("common");
  const [enroll, setEnroll] = useState<EnrollResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/v1/auth/2fa", {
          method: "POST",
          body: JSON.stringify({ action: "enable" }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data as EnrollResult;
          if (!cancelled) setEnroll(data);
          const dataUrl = await QRCode.toDataURL(data.uri, { width: 220, margin: 1, errorCorrectionLevel: "M" });
          if (!cancelled) setQrDataUrl(dataUrl);
        } else {
          if (!cancelled) setError(t("enableFailed"));
        }
      } catch {
        if (!cancelled) setError(t("enableFailed"));
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

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
        onComplete(data.recoveryCodes);
      } else {
        setError(t("verifyFailed"));
        setToken("");
      }
    } catch {
      setError(t("verifyFailed"));
    }
    setBusy(false);
  }

  if (error && !enroll) {
    return (
      <div className="space-y-4 max-w-lg">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors">
          {t("cancel")}
        </button>
      </div>
    );
  }

  if (!enroll) return null;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-fg-muted">{t("enrollHint")}</p>
      <div className="flex flex-wrap items-start gap-4">
        {qrDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={qrDataUrl} alt={t("qrAlt")} width={220} height={220} className="rounded-lg border border-border-primary bg-white p-2" data-testid="totp-qr" />
        ) : (
          <div className="w-[220px] h-[220px] rounded-lg border border-border-primary bg-bg-primary flex items-center justify-center text-xs text-fg-muted">
            {t("qrFailed")}
          </div>
        )}
        <div className="flex-1 min-w-[16rem] space-y-3">
          <div className="rounded-lg border border-border-primary bg-bg-primary p-4">
            <p className="text-xs text-fg-muted mb-1">{t("secretLabel")}</p>
            <p className="font-mono text-sm break-all select-all" data-testid="totp-secret">{enroll.secret}</p>
            <p className="text-xs text-fg-muted mt-2">{t("secretHint")}</p>
          </div>
          <div>
            <label htmlFor="totp-token" className="block text-sm font-medium text-fg-secondary mb-1">{t("tokenLabel")}</label>
            <input
              id="totp-token" inputMode="numeric" value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg text-center tracking-[0.5em]"
            />
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleVerify} disabled={busy || token.length !== 6}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity">
          {busy ? tc("loading") : t("verify")}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
