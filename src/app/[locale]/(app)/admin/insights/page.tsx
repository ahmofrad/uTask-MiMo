import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { OrgDashboard } from "@/components/dashboard/org-dashboard";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">Organization Insights</h1>
      <OrgDashboard />
    </div>
  );
}
