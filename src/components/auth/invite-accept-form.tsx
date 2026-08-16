"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

export function InviteAcceptForm({ token }: { token: string }) {
  const t = useTranslations("auth.login");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setLoading(true);

    try {
      const response = await apiFetch(`/api/v1/auth/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      setSuccess(true);
      window.setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <div role="status" className="p-3 text-sm text-success bg-success-bg border border-success/20 rounded-lg">{t("inviteSuccess")}</div>;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <div role="alert" className="p-3 text-sm text-destructive bg-danger-bg border border-danger/20 rounded-lg">{t("inviteError")}</div>}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-fg-secondary mb-1">
          {t("inviteDisplayName")}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg-secondary mb-1">
          {t("invitePassword")}
        </label>
        <input
          id="password"
          name="password"
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
        {loading ? t("inviteSaving") : t("inviteSubmit")}
      </button>
    </form>
  );
}
