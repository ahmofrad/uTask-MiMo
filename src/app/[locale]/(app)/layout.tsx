import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/rbac/can";
import { getManagedDepartmentIds } from "@/lib/departments";
import { QuickAddPalette } from "@/components/search/quick-add";
import { SearchDialog } from "@/components/search/dialog";
import { CommandPalette } from "@/components/shell/command-palette";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("common");
  const isAdmin = await can(session.user.id!, "user:manage");
  const managedDepartmentIds = isAdmin ? null : await getManagedDepartmentIds(session.user.id!);
  const canManageGroups = isAdmin || (managedDepartmentIds !== null && managedDepartmentIds.length > 0);

  return (
    <div className="min-h-screen bg-bg-app flex w-full max-w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-fg-inverse focus:text-sm focus:font-medium"
      >
        {t("skipToContent")}
      </a>
      <QuickAddPalette />
      <SearchDialog />
      <CommandPalette />
      <Sidebar isAdmin={isAdmin} canManageGroups={canManageGroups} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header email={session.user?.email ?? ""} name={session.user?.name ?? ""} isAdmin={isAdmin} canManageGroups={canManageGroups} />
        <main id="main-content" className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
