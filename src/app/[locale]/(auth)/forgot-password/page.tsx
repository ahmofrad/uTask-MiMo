import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg-primary">{t("forgotTitle")}</h1>
        <p className="text-sm text-fg-muted mt-2">
          {t("forgotDescription")}
        </p>
      </div>

      <form className="space-y-4" action="/api/v1/auth/forgot-password" method="POST">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-fg-secondary mb-1">
            {t("login.emailLabel")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="you@company.com"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          Send reset link
        </button>
      </form>

      <div className="text-center">
        <Link href="/login" className="text-sm text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
