import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { LanguageSettings } from "@/components/settings/language-settings";
import { TokensSettings } from "@/components/settings/tokens-settings";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border-primary rounded-xl bg-bg-surface p-5">
      <h2 className="text-lg font-semibold text-fg-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("settings");

  const sessions = await prisma.session.findMany({
    where: { userId: session.user.id },
    orderBy: { expires: "desc" },
    select: { id: true, expires: true },
  });

  const events = [
    { key: "assigned", label: t("assigned") },
    { key: "mentioned", label: t("mentioned") },
    { key: "commented", label: t("commented") },
    { key: "status_changed", label: t("statusChanged") },
    { key: "due_soon", label: t("dueSoon") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title={t("profile")}>
          <ProfileSettings
            userId={session.user.id}
            name={session.user.name}
            email={session.user.email}
          />
        </Section>

        <Section title={t("appearance")}>
          <AppearanceSettings />
        </Section>

        <Section title={t("language")}>
          <LanguageSettings />
        </Section>
      </div>

      <Section title={t("notifications")}>
        <div className="overflow-hidden rounded-lg border border-border-primary">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-start p-3 text-fg-muted font-medium">{t("event")}</th>
                <th className="text-center p-3 text-fg-muted font-medium">{t("inApp")}</th>
                <th className="text-center p-3 text-fg-muted font-medium">{t("email")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.key} className="border-b border-border-primary last:border-0">
                  <td className="p-3 text-fg-primary">{event.label}</td>
                  <td className="p-3 text-center">
                    <input type="checkbox" defaultChecked className="accent-accent" aria-label={`${event.label} ${t("inApp")}`} />
                  </td>
                  <td className="p-3 text-center">
                    <input type="checkbox" defaultChecked className="accent-accent" aria-label={`${event.label} ${t("email")}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title={t("tokens")}>
          <TokensSettings />
        </Section>

        <Section title={t("sessions")}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-fg-muted">{t("sessions")}</span>
            <button className="text-sm text-destructive hover:underline">{t("signOutAll")}</button>
          </div>
          <div className="space-y-3">
            {sessions.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 p-4 bg-bg-primary border border-border-secondary rounded-lg">
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
        </Section>
      </div>
    </div>
  );
}
