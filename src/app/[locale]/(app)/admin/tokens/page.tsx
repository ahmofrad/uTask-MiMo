import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

export default async function AdminTokensPage() {
  const session = await auth();
  const isAdmin = session?.user?.id && (await can(session.user.id, "api_token:manage"));
  const tokens = isAdmin
    ? await prisma.apiToken.findMany({
        orderBy: { createdAt: "desc" },
      })
    : [];

  const users = isAdmin
    ? await prisma.user.findMany({ select: { id: true, displayName: true, email: true } })
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">API Tokens</h1>
      {!isAdmin ? (
        <p className="text-fg-muted">You do not have permission to view this page.</p>
      ) : tokens.length === 0 ? (
        <p className="text-fg-muted">No API tokens issued.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-start p-2">Name</th>
              <th className="text-start p-2">User</th>
              <th className="text-start p-2">Scopes</th>
              <th className="text-start p-2">Last Used</th>
              <th className="text-start p-2">Expires</th>
              <th className="text-start p-2">Revoked</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((tok) => {
              const u = userMap.get(tok.userId);
              return (
                <tr key={tok.id} className="border-b">
                  <td className="p-2">{tok.name}</td>
                  <td className="p-2">{u?.email ?? tok.userId}</td>
                  <td className="p-2">{tok.scopes.join(", ")}</td>
                  <td className="p-2">{tok.lastUsedAt?.toISOString().slice(0, 10) ?? "never"}</td>
                  <td className="p-2">{tok.expiresAt?.toISOString().slice(0, 10) ?? "never"}</td>
                  <td className="p-2">{tok.revokedAt ? tok.revokedAt.toISOString().slice(0, 10) : "no"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
