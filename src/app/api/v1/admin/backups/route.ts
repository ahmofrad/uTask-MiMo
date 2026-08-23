import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";

const BACKUP_NAME = /^taskapp-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}\.dump$/;

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await can(authResult.userId, "user:manage", authResult.organizationId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const directory = process.env.BACKUP_LOCAL_DIR?.trim() || "/var/lib/taskapp/backups";
  let backups: Array<{ name: string; sizeBytes: number; createdAt: string }> = [];
  try {
    const names = await readdir(directory);
    backups = (
      await Promise.all(
        names
          .filter((name) => BACKUP_NAME.test(name))
          .map(async (name) => {
            const filePath = path.join(directory, name);
            const metadata = await stat(filePath);
            if (!metadata.isFile()) return null;
            return {
              name,
              sizeBytes: metadata.size,
              createdAt: metadata.birthtime.toISOString(),
            };
          }),
      )
    )
      .filter((backup): backup is NonNullable<typeof backup> => backup !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error: unknown) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      return NextResponse.json(
        { error: { code: "BACKUP_INVENTORY_UNAVAILABLE", message: "Backup inventory is unavailable" } },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    data: {
      destination: process.env.BACKUP_DESTINATION ?? "local",
      retentionDays: Number(process.env.BACKUP_RETENTION_DAYS) || 30,
      backups,
    },
  });
}
