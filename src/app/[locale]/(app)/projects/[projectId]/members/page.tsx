import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MembersClient } from "@/components/project/members-client";

export default async function MembersPage({ params }: { params: { projectId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.projectId },
    include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
    orderBy: { addedAt: "asc" },
  });

  return (
    <MembersClient
      projectId={params.projectId}
      initialMembers={members.map((m) => ({
        userId: m.userId,
        projectRole: m.projectRole,
        addedAt: m.addedAt.toISOString(),
        user: m.user,
      }))}
    />
  );
}
