import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export default async function WorkspaceRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isAdmin = await can(session.user.id, "user:manage");

  return <WorkspacePage isAdmin={isAdmin} />;
}
