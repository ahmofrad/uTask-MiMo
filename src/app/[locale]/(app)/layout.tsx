import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { QuickAddPalette } from "@/components/search/quick-add";
import { SearchDialog } from "@/components/search/dialog";
import { CommandPalette } from "@/components/shell/command-palette";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = await can(session.user.id!, "user:manage");

  return (
    <div className="min-h-screen bg-bg-primary flex w-full max-w-full">
      <QuickAddPalette />
      <SearchDialog />
      <CommandPalette />
      <Sidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header email={session.user?.email ?? ""} name={session.user?.name ?? ""} isAdmin={isAdmin} />
        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
