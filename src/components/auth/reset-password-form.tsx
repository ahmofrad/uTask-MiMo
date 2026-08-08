"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.login");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setLoading(true);

    try {
      const response = await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      setSuccess(true);
      window.setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <div role="status" className="p-3 text-sm text-success bg-success-bg border border-success/20 rounded-lg">{t("resetSuccess")}</div>;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="token" value={token} />
      {error && <div role="alert" className="p-3 text-sm text-destructive bg-danger-bg border border-danger/20 rounded-lg">{t("resetError")}</div>}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg-secondary mb-1">{t("resetNewPassword")}</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-fg-secondary mb-1">{t("resetConfirmPassword")}</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? t("resetSaving") : t("resetSubmit")}
      </button>
    </form>
  );
}
