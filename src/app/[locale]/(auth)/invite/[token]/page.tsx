import { getTranslations } from "next-intl/server";
import { InviteAcceptForm } from "@/components/auth/invite-accept-form";

export default async function InviteAcceptPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const t = await getTranslations("auth.login");

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg-primary">{t("inviteTitle")}</h1>
        <p className="text-sm text-fg-muted mt-2">
          {t("inviteDescription")}
        </p>
      </div>

      <InviteAcceptForm token={token} />
    </div>
  );
}
