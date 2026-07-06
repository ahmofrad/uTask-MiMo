import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function LdapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">LDAP Configuration</h1>
        <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
          Test connection
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="ldap-enabled" className="accent-accent" defaultChecked />
          <label htmlFor="ldap-enabled" className="text-sm text-fg-primary font-medium">Enabled</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Server URL</label>
          <input
            type="url"
            placeholder="ldaps://ldap.corp.example.com:636"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Bind DN</label>
          <input
            type="text"
            placeholder="cn=svc-taskapp,ou=svc,dc=corp,dc=com"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Bind password</label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Search base</label>
          <input
            type="text"
            placeholder="ou=people,dc=corp,dc=com"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">Search filter</label>
          <input
            type="text"
            placeholder="(&(objectClass=person)(uid={{username}}))"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
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
