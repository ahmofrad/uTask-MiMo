import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "user:manage");
  if (!allowed) redirect("/");

  const t = await getTranslations("admin");

  const navLinks = [
    { href: "/admin/users", label: t("users") },
    { href: "/admin/webhooks", label: t("webhooks") },
    { href: "/admin/webhook-deliveries", label: t("auditLog") },
    { href: "/admin/sso", label: t("sso") },
    { href: "/admin/backups", label: t("backups") },
  ];

  return (
    <div className="px-6 py-6 flex gap-6">
      <nav className="w-48 shrink-0 space-y-0.5">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">{t("title")}</h2>
        {navLinks.map((link) => (
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
