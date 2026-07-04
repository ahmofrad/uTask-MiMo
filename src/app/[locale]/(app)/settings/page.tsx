import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">My Settings</h1>
      <p className="text-fg-secondary">User preferences page coming soon.</p>
    </div>
  );
}
