import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { WbsEditor } from "@/components/task/wbs-editor";
import { canReadProject } from "@/lib/rbac";

export default async function WbsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!(await canReadProject(session.user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  return <WbsEditor projectId={projectId} projectName={project.name} />;
}