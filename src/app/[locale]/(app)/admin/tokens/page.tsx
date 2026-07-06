import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function AdminTokensPage() {
  const session = await auth();
  const isAdmin = session?.user?.id && (await can(session.user.id, "api_token:manage"));

  const t = await getTranslations("token");
  const tCommon = await getTranslations("common");

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
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
      {!isAdmin ? (
        <p className="text-fg-muted">{t("noPermission")}</p>
      ) : tokens.length === 0 ? (
        <p className="text-fg-muted">{t("empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-start p-2">{t("fields.name")}</th>
              <th className="text-start p-2">{t("fields.user")}</th>
              <th className="text-start p-2">{t("fields.scopes")}</th>
              <th className="text-start p-2">{t("fields.lastUsed")}</th>
              <th className="text-start p-2">{t("fields.expires")}</th>
              <th className="text-start p-2">{t("fields.revoked")}</th>
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
                  <td className="p-2">{tok.lastUsedAt?.toISOString().slice(0, 10) ?? tCommon("never")}</td>
                  <td className="p-2">{tok.expiresAt?.toISOString().slice(0, 10) ?? tCommon("never")}</td>
                  <td className="p-2">{tok.revokedAt ? tok.revokedAt.toISOString().slice(0, 10) : tCommon("no")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
