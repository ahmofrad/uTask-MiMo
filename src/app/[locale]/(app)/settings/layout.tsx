import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settings");

  const settingsLinks = [
    { href: "/settings/profile", label: t("profile") },
    { href: "/settings/appearance", label: t("appearance") },
    { href: "/settings/language", label: t("language") },
    { href: "/settings/notifications-settings", label: t("notifications") },
    { href: "/settings/tokens", label: t("tokens") },
    { href: "/settings/sessions", label: t("sessions") },
  ];

  return (
    <div className="px-6 py-6 flex gap-6">
      <nav className="w-48 shrink-0 space-y-0.5">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">{t("title")}</h2>
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block px-3 py-2 text-sm rounded-lg text-fg-secondary hover:bg-bg-surface hover:text-fg-primary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
