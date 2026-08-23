import { existsSync } from "node:fs";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const startedAt = performance.now();
  const value = await fn();
  return { ms: Math.round((performance.now() - startedAt) * 10) / 10, value };
}

export default async function HealthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isAdmin = await can(session.user.id, "user:manage");
  if (!isAdmin) redirect("/");

  const t = await getTranslations("admin.healthPage");

  // DB probe (with timeout guard).
  let db: { ok: boolean; ms?: number; detail?: string } = { ok: false };
  try {
    const result = await timeIt(() => prisma.$queryRaw`SELECT 1`);
    db = { ok: true, ms: result.ms };
  } catch (err) {
    db = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  // Redis probe.
  let redis: { ok: boolean; ms?: number; detail?: string } = { ok: false };
  try {
    const result = await timeIt(async () => {
      const client = await getRedis();
      return client.ping();
    });
    redis = result.value === "PONG" ? { ok: true, ms: result.ms } : { ok: false, detail: `Unexpected ping reply: ${String(result.value)}` };
  } catch (err) {
    redis = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  // Prisma migration state.
  let migrations: { ok: true; applied: number; pending: number } | { ok: false; detail: string } =
    { ok: true, applied: 0, pending: 0 };
  try {
    const rows = await prisma.$queryRaw<{ finished: bigint; total: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE finished_at IS NOT NULL) AS finished,
        COUNT(*) AS total
      FROM "_prisma_migrations"
    `;
    const finished = Number(rows[0]?.finished ?? 0);
    const total = Number(rows[0]?.total ?? 0);
    migrations = { ok: true, applied: finished, pending: total - finished };
  } catch (err) {
    migrations = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  // Worker readiness marker (written by the worker process).
  const workerReady = existsSync(process.env.WORKER_READY_FILE ?? "/tmp/taskapp-worker-ready");

  const checks = [
    {
      label: t("db"),
      ok: db.ok,
      detail: db.ok && db.ms !== undefined ? `${db.ms} ms` : (db.detail ?? ""),
    },
    {
      label: t("redis"),
      ok: redis.ok,
      detail: redis.ok && redis.ms !== undefined ? `${redis.ms} ms` : (redis.detail ?? ""),
    },
    {
      label: t("migrations"),
      ok: migrations.ok && migrations.pending === 0,
      detail: migrations.ok
        ? t("migrationsDetail", { applied: migrations.applied, pending: migrations.pending })
        : migrations.detail,
    },
    {
      label: t("worker"),
      ok: workerReady,
      detail: workerReady ? t("workerRunning") : t("workerNotRunning"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {checks.map((check) => (
          <div
            key={check.label}
            className={
              "rounded-xl border p-5 " +
              (check.ok ? "border-border-primary bg-bg-surface" : "border-danger/40 bg-danger-bg")
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-fg-primary">{check.label}</span>
              <span
                className={
                  "inline-flex items-center gap-1.5 text-xs font-medium " +
                  (check.ok ? "text-tone-tertiary" : "text-danger")
                }
              >
                <span className={"inline-block w-2 h-2 rounded-full " + (check.ok ? "bg-tone-tertiary" : "bg-danger")} />
                {check.ok ? t("ok") : t("down")}
              </span>
            </div>
            {check.detail && <p className="mt-2 text-xs text-fg-muted break-words">{check.detail}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-surface p-5">
        <h2 className="text-sm font-semibold text-fg-primary mb-3">{t("runtime")}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-fg-muted">{t("nodeVersion")}</dt><dd className="text-fg-primary">{process.version}</dd></div>
          <div className="flex justify-between"><dt className="text-fg-muted">{t("uptimeSeconds")}</dt><dd className="text-fg-primary">{Math.round(process.uptime())}</dd></div>
          <div className="flex justify-between"><dt className="text-fg-muted">{t("environment")}</dt><dd className="text-fg-primary">{process.env.NODE_ENV ?? "development"}</dd></div>
        </dl>
      </div>
    </div>
  );
}