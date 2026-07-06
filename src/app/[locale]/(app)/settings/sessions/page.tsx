import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function SessionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("settings");

  const sessions = await prisma.session.findMany({
    where: { userId: session.user.id },
    orderBy: { expires: "desc" },
    select: {
      id: true,
      expires: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("sessions")}</h1>
        <button className="text-sm text-destructive hover:underline">{t("signOutAll")}</button>
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        {sessions.map((s, i) => (
          <div key={s.id} className="flex items-center gap-4 p-4 bg-bg-surface border border-border-primary rounded-lg">
            <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-success" : "bg-fg-subtle"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fg-primary">
                  {i === 0 ? t("thisDevice") : t("session")}
                </span>
                {i === 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-success-bg text-success">{t("current")}</span>
                )}
              </div>
              <div className="text-xs text-fg-muted mt-1">
                {t("expires")}: {s.expires.toLocaleString()}
              </div>
            </div>
            {i > 0 && (
              <button className="text-xs text-fg-muted hover:text-destructive transition-colors">{t("signOut")}</button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">{t("noSessions")}</p>
        )}
      </div>
    </div>
  );
}
