import { getTranslations } from "next-intl/server";

export default async function ResetPasswordPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const t = await getTranslations("auth.login");

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg-primary">{t("resetTitle")}</h1>
      </div>

      <form className="space-y-4" action="/api/v1/auth/reset-password" method="POST">
        <input type="hidden" name="token" value={token} />

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-fg-secondary mb-1">
            {t("resetNewPassword")}
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

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-fg-secondary mb-1">
            {t("resetConfirmPassword")}
          </label>
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
          className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          {t("resetSubmit")}
        </button>
      </form>
    </div>
  );
}
