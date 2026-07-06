import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/date/format";
import { ReplayButton } from "@/components/admin/replay-button";

export default async function WebhookDeliveriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const deliveries = await prisma.webhookDelivery.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 50,
    include: { webhook: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">Webhook Deliveries</h1>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-start p-3 text-fg-muted font-medium">When</th>
              <th className="text-start p-3 text-fg-muted font-medium">Webhook</th>
              <th className="text-start p-3 text-fg-muted font-medium">Event</th>
              <th className="text-start p-3 text-fg-muted font-medium">Status</th>
              <th className="text-start p-3 text-fg-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-border-primary last:border-0 hover:bg-bg-surface-2 transition-colors">
                <td className="p-3 text-fg-secondary">{formatDateTime(new Date(d.scheduledAt), "fa-IR")}</td>
                <td className="p-3 text-fg-primary">{d.webhook?.name}</td>
                <td className="p-3 text-fg-primary">{d.eventType}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    d.responseStatus && d.responseStatus >= 200 && d.responseStatus < 300
                      ? "bg-success-bg text-success"
                      : d.responseStatus
                      ? "bg-danger-bg text-danger"
                      : "bg-bg-surface-2 text-fg-muted"
                  }`}>
                    {d.responseStatus ?? "pending"}
                  </span>
                </td>
                <td className="p-3">
                  <ReplayButton deliveryId={d.id} />
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-fg-muted">No deliveries yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
