"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

type OtpFormProps = {
  email: string;
  password: string;
  onBack: () => void;
};

export function OtpForm({ email, password, onBack }: OtpFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const t = useTranslations("auth.login");

  async function handleOtpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        totpCode: otpCode.trim(),
        redirect: false,
      });
      if (result?.error) {
        setError(t("errors.invalidCode"));
      } else {
        window.location.href = "/";
      }
    } catch {
      setError(t("errors.invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleOtpSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="flex items-center gap-2 p-3 text-sm text-destructive bg-danger-bg border border-danger/20 rounded-lg">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="otp" className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("twoFactorTitle")}
        </label>
        <p className="text-xs text-fg-muted mb-2">{t("twoFactorHint")}</p>
        <input
          id="otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
          placeholder={t("otpPlaceholder")}
          autoFocus
          className="w-full px-3.5 py-2.5 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors tracking-[0.5em] text-center"
        />
      </div>

      <button
        type="submit"
        disabled={loading || otpCode.trim().length < 6}
        className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t("verifying")}
          </span>
        ) : t("otpSubmit")}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full py-2 px-4 text-sm text-fg-muted hover:text-fg-secondary transition-colors"
      >
        {t("backToPassword")}
      </button>
    </form>
  );
}
