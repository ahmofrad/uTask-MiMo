import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const scriptPath = `${process.cwd()}/scripts/backup.sh`;

  try {
    const { stdout } = await execAsync(`bash ${scriptPath}`, {
      timeout: 300_000, // 5 minutes
      env: { ...process.env },
    });

    await logAudit({
      actorUserId: userId,
      action: "created",
      entityType: "backup",
      entityId: "manual",
      after: { triggeredBy: "admin", output: stdout.slice(-500) },
    });

    return NextResponse.json({
      data: { success: true, output: stdout.slice(-1000) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    await logAudit({
      actorUserId: userId,
      action: "created",
      entityType: "backup",
      entityId: "manual",
      after: { triggeredBy: "admin", error: message.slice(-500) },
    });

    return NextResponse.json(
      { error: { code: "BACKUP_FAILED", message: message.slice(0, 500) } },
      { status: 500 },
    );
  }
}