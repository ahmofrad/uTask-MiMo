import { getTranslations } from "next-intl/server";

export default async function InviteAcceptPage({
  params,
}: {
  params: { token: string };
}) {
  const t = await getTranslations("auth.login");

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg-primary">{t("inviteTitle")}</h1>
        <p className="text-sm text-fg-muted mt-2">
          {t("inviteDescription")}
        </p>
      </div>

      <form className="space-y-4" action={`/api/v1/auth/invite/${params.token}`} method="POST">
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
          className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          {t("inviteSubmit")}
        </button>
      </form>
    </div>
  );
}
