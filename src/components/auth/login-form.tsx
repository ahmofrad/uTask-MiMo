"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

type LoginFormProps = {
  ldapConfigured: boolean;
  ssoConfigured: boolean;
  ldapDomain: string;
};

export function LoginForm({ ldapConfigured, ssoConfigured, ldapDomain }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [provider, setProvider] = useState("local");
  const t = useTranslations("auth.login");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      if (provider === "ldap") {
        const result = await signIn("ldap", { email, password, redirect: false });
        if (result?.error) {
          setError(t("errors.invalidCredentials"));
        } else {
          window.location.href = "/";
        }
      } else {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) {
          setError(t("errors.invalidCredentials"));
        } else {
          window.location.href = "/";
        }
      }
    } catch {
      setError(t("errors.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-danger-bg border border-danger/20 rounded-lg">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-3.5 py-2.5 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          placeholder={t("emailPlaceholder")}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("passwordLabel")}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full px-3.5 py-2.5 pr-10 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-secondary transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* LDAP Provider selector */}
      {ldapConfigured && (
        <div>
          <label htmlFor="provider" className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("loginMethod")}
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          >
            <option value="local">{t("localLogin")}</option>
            <option value="ldap">{ldapDomain}</option>
          </select>
        </div>
      )}

      {/* Forgot password */}
      <div className="flex items-center justify-end">
        <Link href="/forgot-password" className="text-xs text-accent hover:underline">
          {t("forgotPassword")}
        </Link>
      </div>

      {/* Login button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t("loggingIn")}
          </span>
        ) : t("submitButton")}
      </button>

      {/* SSO button */}
      {ssoConfigured && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-primary" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-bg-surface text-fg-subtle">{t("divider")}</span>
            </div>
          </div>
          <Link
            href="/login/sso"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {t("ssoButton")}
          </Link>
        </>
      )}
    </form>
  );
}
