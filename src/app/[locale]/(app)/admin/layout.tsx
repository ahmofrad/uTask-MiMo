import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
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

  return (
    <div className="flex gap-8">
      <nav className="w-48 shrink-0 space-y-1">
        <Link
          href="/admin/users"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          Users
        </Link>
        <Link
          href="/admin/departments"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          Departments
        </Link>
        <Link
          href="/admin/settings"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          Settings
        </Link>
        <Link
          href="/admin/settings/smtp"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          SMTP
        </Link>
        <Link
          href="/admin/audit-log"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          Audit Log
        </Link>
        <Link
          href="/admin/webhooks"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          Webhooks
        </Link>
        <Link
          href="/admin/tokens"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          API Tokens
        </Link>
        <Link
          href="/admin/sso"
          className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-secondary hover:text-fg-primary"
        >
          SSO
        </Link>
      </nav>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
