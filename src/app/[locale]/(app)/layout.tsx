import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { NotificationBell } from "@/components/notifications/bell";
import { SearchDialog } from "@/components/search/dialog";
import { SearchTrigger } from "@/components/search/trigger";
import { QuickAddPalette } from "@/components/search/quick-add";
import { LocaleSwitcher } from "@/components/locale/switcher";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = await can(session.user.id, "user:manage");

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <QuickAddPalette />
      <SearchDialog />
      <nav className="w-56 shrink-0 border-e border-border-primary bg-bg-secondary p-4 space-y-1">
        <Link href="/" className="text-lg font-bold text-fg-primary block mb-6">uTask</Link>
        <Link
          href="/tasks"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary hover:text-fg-primary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Tasks
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary hover:text-fg-primary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
        {isAdmin && (
          <Link
            href="/admin/users"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary hover:text-fg-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin
          </Link>
        )}
      </nav>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border-primary bg-bg-secondary px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <SearchTrigger />
            <div className="flex items-center gap-4">
              <LocaleSwitcher />
              <NotificationBell />
              <span className="text-sm text-fg-secondary">{session.user?.email}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
