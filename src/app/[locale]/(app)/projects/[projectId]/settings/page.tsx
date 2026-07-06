import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function ProjectSettingsPage({ params }: { params: { projectId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  return (
    <div className="px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">Project Settings</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Name</label>
          <input
            type="text"
            defaultValue={project.name}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Description</label>
          <textarea
            defaultValue={project.description ?? ""}
            rows={3}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Visibility</label>
          <select
            defaultValue={project.visibility}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          >
            <option value="private">Private</option>
            <option value="department">Department</option>
            <option value="org">Organization</option>
          </select>
        </div>

        <div className="border-t border-border-primary pt-6">
          <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
          <p className="text-xs text-fg-muted mb-3">Archiving a project hides it from views but preserves all data.</p>
          <button className="px-4 py-2 text-sm font-medium rounded-md border border-danger text-destructive hover:bg-danger-bg transition-colors">
            Archive project
          </button>
        </div>
      </div>
    </div>
  );
}
