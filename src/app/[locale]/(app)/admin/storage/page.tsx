import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function StoragePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">Storage Configuration</h1>
        <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
          Test connection
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-3">Provider</label>
          <div className="space-y-2">
            {["S3-compatible (MinIO, AWS S3)", "Local filesystem"].map((provider) => (
              <label key={provider} className="flex items-center gap-2 text-sm text-fg-primary">
                <input type="radio" name="provider" defaultChecked={provider.includes("S3")} className="accent-accent" />
                {provider}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-fg-secondary mb-3">S3-compatible settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Endpoint</label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Bucket</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Access key</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Secret key</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border-primary pt-6">
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity">
            Save configuration
          </button>
        </div>
      </div>
    </div>
  );
}
