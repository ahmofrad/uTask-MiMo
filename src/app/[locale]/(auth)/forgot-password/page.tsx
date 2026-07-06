"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { apiFetch } from "@/lib/api-fetch";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.login");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg-primary">{t("forgotTitle")}</h1>
        <p className="text-sm text-fg-muted mt-2">{t("forgotDescription")}</p>
      </div>

      {sent ? (
        <div className="text-center space-y-4">
          <div className="p-3 text-sm text-success bg-success-bg border border-success/20 rounded-lg">
            {t("forgotSuccess")}
          </div>
          <Link href="/login" className="text-sm text-accent hover:underline">
            {t("ssoBackToLocal")}
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fg-secondary mb-1">
              {t("emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? t("loggingIn") : t("forgotSubmit")}
          </button>
        </form>
      )}

      <div className="text-center">
        <Link href="/login" className="text-sm text-accent hover:underline">
          {t("ssoBackToLocal")}
        </Link>
      </div>
    </div>
  );
}
