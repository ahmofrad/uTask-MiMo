import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const scriptPath = `${process.cwd()}/scripts/backup.sh`;

  try {
    const { stdout } = await execAsync(`bash ${scriptPath}`, {
      timeout: 300_000, // 5 minutes
      env: { ...process.env },
    });

    await logAudit({
      actorUserId: session.user.id,
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
      actorUserId: session.user.id,
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
