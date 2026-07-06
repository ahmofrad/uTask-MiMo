import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { UserDetailClient } from "./user-detail-client";

export default async function UserDetailPage({ params }: { params: { userId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) notFound();

  const globalRole = await prisma.role.findFirst({
    where: { userId: params.userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });

  const memberships = await prisma.projectMember.findMany({
    where: { userId: params.userId },
    include: { project: { select: { id: true, name: true } } },
  });

  return (
    <UserDetailClient
      userId={user.id}
      displayName={user.displayName}
      email={user.email}
      status={user.status}
      globalRole={globalRole?.type ?? null}
      projectMemberships={memberships.map((m) => ({
        projectId: m.project.id,
        projectName: m.project.name,
        projectRole: m.projectRole,
      }))}
    />
  );
}
