import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function SamlPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">SAML 2.0 Configuration</h1>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
            Upload IdP metadata
          </button>
          <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
            Test login
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="saml-enabled" className="accent-accent" defaultChecked />
          <label htmlFor="saml-enabled" className="text-sm text-fg-primary font-medium">Enabled</label>
        </div>

        <div>
          <h3 className="text-sm font-medium text-fg-secondary mb-3">Service Provider</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Entity ID</label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
                readOnly
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">ACS URL</label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
                readOnly
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-fg-secondary mb-3">Identity Provider</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Entity ID</label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">SSO URL</label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Certificate</label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm font-mono resize-none"
                placeholder="-----BEGIN CERTIFICATE-----"
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
