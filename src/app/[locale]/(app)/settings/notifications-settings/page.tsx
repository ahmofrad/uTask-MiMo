import { getTranslations } from "next-intl/server";

export default async function NotificationSettingsPage() {
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
      <h1 className="text-2xl font-bold text-fg-primary">{t("notifications")}</h1>

      <div className="border border-border-primary rounded-xl bg-bg-surface overflow-hidden">
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
                    <input type="checkbox" defaultChecked className="accent-accent" />
                  </td>
                  <td className="p-3 text-center">
                    <input type="checkbox" defaultChecked className="accent-accent" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
