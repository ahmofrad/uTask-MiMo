import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { WbsEditor } from "@/components/task/wbs-editor";

export default async function WbsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  return <WbsEditor projectId={projectId} />;
}