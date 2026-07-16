import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MembersClient } from "@/components/project/members-client";

export default async function MembersPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
    orderBy: { addedAt: "asc" },
  });

  return (
    <MembersClient
      projectId={projectId}
      initialMembers={members.map((m) => ({
        userId: m.userId,
        projectRole: m.projectRole,
        addedAt: m.addedAt.toISOString(),
        user: m.user,
      }))}
    />
  );
}
