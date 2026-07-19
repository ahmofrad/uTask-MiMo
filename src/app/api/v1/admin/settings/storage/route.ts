import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { getInstanceSetting, setInstanceSetting } from "@/lib/settings/instance";
import { logAudit } from "@/lib/audit/log";

type StorageConfig = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  useSSL: boolean;
};

const DEFAULT_STORAGE: StorageConfig = {
  endpoint: "",
  accessKey: "",
  secretKey: "",
  bucket: "",
  region: "us-east-1",
  useSSL: true,
};

const PUBLIC_KEYS: (keyof StorageConfig)[] = [
  "endpoint",
  "accessKey",
  "bucket",
  "region",
  "useSSL",
];

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const storage = await getInstanceSetting<StorageConfig>("storage", DEFAULT_STORAGE);

  const safe: Record<string, unknown> = {};
  for (const k of PUBLIC_KEYS) {
    safe[k] = storage[k];
  }

  return NextResponse.json({ data: safe });
}

export async function PUT(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = (await request.json()) as Partial<StorageConfig>;

  const allowedKeys: (keyof StorageConfig)[] = [
    "endpoint",
    "accessKey",
    "secretKey",
    "bucket",
    "region",
    "useSSL",
  ];

  const storage: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if ((allowedKeys as string[]).includes(key)) {
      storage[key] = value;
    }
  }

  if (Object.keys(storage).length > 0) {
    await setInstanceSetting("storage", storage, userId);
  }

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "settings",
    entityId: "storage",
    after: body,
  });

  return NextResponse.json({ data: { success: true } });
}
