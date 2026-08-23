import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { LanguageSettings } from "@/components/settings/language-settings";
import { DatetimeSettings } from "@/components/settings/datetime-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { TokensSettings } from "@/components/settings/tokens-settings";
import { SessionsSettings } from "@/components/settings/sessions-settings";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border-primary rounded-xl bg-bg-surface p-5 overflow-hidden">
      <h2 className="text-lg font-semibold text-fg-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      timeZone: true,
      timeFormat: true,
      dualCalendar: true,
      totpEnabled: true,
      accentColor: true,
    },
  });

  const t = await getTranslations("settings");

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
          <AppearanceSettings userId={session.user.id} />
        </Section>

        <Section title={t("language")}>
          <LanguageSettings userId={session.user.id} />
        </Section>

        <Section title={t("datetime")}>
          <DatetimeSettings
            timeZone={me?.timeZone ?? null}
            timeFormat={(me?.timeFormat as "H12" | "H24") ?? "H24"}
            dualCalendar={me?.dualCalendar ?? false}
          />
        </Section>
      </div>

      <Section title={t("security")}>
        <SecuritySettings totpEnabled={me?.totpEnabled ?? false} />
      </Section>

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
          <SessionsSettings />
        </Section>
      </div>
    </div>
  );
}
