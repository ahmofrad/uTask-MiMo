import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
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

  return (
    <div className="min-h-screen bg-bg-primary">
      <QuickAddPalette />
      <SearchDialog />
      <header className="border-b border-border-primary bg-bg-secondary px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/" className="text-lg font-bold text-fg-primary">uTask</Link>
          <SearchTrigger />
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <NotificationBell />
            <span className="text-sm text-fg-secondary">{session.user?.email}</span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </div>
  );
}
