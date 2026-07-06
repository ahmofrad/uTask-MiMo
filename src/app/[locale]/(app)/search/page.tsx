import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function SearchPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">Search</h1>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search tasks, projects, comments..."
          className="w-full px-4 py-3 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
      </div>
      <p className="text-sm text-fg-muted text-center py-8">
        Type to search across tasks, projects, and comments.
      </p>
    </div>
  );
}
