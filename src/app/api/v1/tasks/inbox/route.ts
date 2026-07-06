import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getInboxTasks } from "@/lib/tasks";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const result = await getInboxTasks(session.user.id);

  return NextResponse.json({ data: result });
}
