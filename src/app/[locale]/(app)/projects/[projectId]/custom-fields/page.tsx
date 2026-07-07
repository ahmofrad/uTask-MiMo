import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CustomFieldsManager } from "@/components/custom-field/custom-fields-manager";

export const dynamic = "force-dynamic";

export default async function CustomFieldsPage({ params }: { params: { projectId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  const fields = await prisma.customField.findMany({
    where: { projectId: params.projectId, archivedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, key: true, type: true, required: true },
  });

  return (
    <div className="px-4 py-8 max-w-2xl">
      <CustomFieldsManager
        projectId={params.projectId}
        initialFields={fields.map((f) => ({
          id: f.id,
          name: f.name,
          key: f.key,
          type: f.type,
          required: f.required,
        }))}
      />
    </div>
  );
}
