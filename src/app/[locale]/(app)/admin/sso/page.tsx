import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";

export default async function SsoConfigPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "sso:configure");
  if (!allowed) redirect("/");

  const ldapUrl = process.env.LDAP_URL ?? "(not configured)";
  const samlEnabled = process.env.SAML_CERT ? "Configured" : "Not configured";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-fg-primary">SSO Configuration</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg-primary">LDAP</h2>
        <div className="max-w-md space-y-3">
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1">Server URL</label>
            <input
              defaultValue={ldapUrl}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1">Base DN</label>
            <input
              defaultValue={process.env.LDAP_BASE_DN ?? "dc=example,dc=com"}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm"
              readOnly
            />
          </div>
          <p className="text-sm text-fg-tertiary">
            LDAP authentication is configured via environment variables. See{" "}
            <code className="text-accent text-xs">AUTH.md</code> for available options.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg-primary">SAML 2.0</h2>
        <div className="max-w-md space-y-3">
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1">Status</label>
            <input
              defaultValue={samlEnabled}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm"
              readOnly
            />
          </div>
          <p className="text-sm text-fg-tertiary">
            SAML configuration uses environment variables (<code className="text-accent text-xs">SAML_CERT</code>,{" "}
            <code className="text-accent text-xs">SAML_ENTRY_POINT</code>,{" "}
            <code className="text-accent text-xs">SAML_ISSUER</code>).
          </p>
        </div>
      </section>

      <p className="text-sm text-fg-tertiary border-t border-border-primary pt-4">
        SSO settings editing via admin UI coming in a future release. For now, configure via environment variables
        and restart the server.
      </p>
    </div>
  );
}
