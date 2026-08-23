import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { problemResponse } from "@/lib/api/problem";
import { logAudit } from "@/lib/audit/log";
import { exec } from "child_process";
import { promisify } from "util";
import { recordBackupFailure, recordBackupSuccess } from "@/lib/backup-metrics";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  if (!(await can(userId, "user:manage", organizationId))) {
    return problemResponse(request, 403, "FORBIDDEN", "Insufficient permissions");
  }

  const scriptPath = `${process.cwd()}/scripts/backup.sh`;

  try {
    const { stdout } = await execAsync(`bash ${scriptPath}`, {
      timeout: 300_000, // 5 minutes
      env: { ...process.env },
    });

    recordBackupSuccess();
    await logAudit({
      organizationId: authResult.organizationId,
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
    recordBackupFailure();
    const message = err instanceof Error ? err.message : String(err);

    await logAudit({
      organizationId: authResult.organizationId,
      actorUserId: userId,
      action: "created",
      entityType: "backup",
      entityId: "manual",
      after: { triggeredBy: "admin", error: message.slice(-500) },
    });

    return problemResponse(request, 500, "BACKUP_FAILED", message.slice(0, 500));
  }
}