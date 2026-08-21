import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { listUserSessions } from "@/lib/auth/session-store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const raw = await listUserSessions(session.user.id);

  const sessions = raw.map((s) => ({
    id: s.id,
    createdAt: new Date(s.createdAt).toISOString(),
    lastUsedAt: new Date(s.lastUsedAt).toISOString(),
  }));

  return NextResponse.json({ data: sessions });
}