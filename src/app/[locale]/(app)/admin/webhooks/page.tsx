import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

export default async function AdminWebhooksPage() {
  const session = await auth();
  const canManage = session?.user?.id && (await can(session.user.id, "webhook:manage"));
  const webhooks = canManage ? await prisma.webhook.findMany({ orderBy: { createdAt: "desc" } }) : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Webhooks</h1>
      {!canManage ? (
        <p className="text-fg-muted">You do not have permission to manage webhooks.</p>
      ) : webhooks.length === 0 ? (
        <p className="text-fg-muted">No webhooks configured.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-start p-2">Name</th>
              <th className="text-start p-2">URL</th>
              <th className="text-start p-2">Events</th>
              <th className="text-start p-2">Active</th>
              <th className="text-start p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((wh) => (
              <tr key={wh.id} className="border-b">
                <td className="p-2">{wh.name}</td>
                <td className="p-2 font-mono text-xs">{wh.url}</td>
                <td className="p-2">{wh.events.join(", ")}</td>
                <td className="p-2">{wh.active ? "Yes" : "No"}</td>
                <td className="p-2">{wh.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
