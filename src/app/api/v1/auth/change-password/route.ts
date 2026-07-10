import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { changePassword } from "@/lib/users";

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "passwordTooShort"),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_REQUEST" } }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message ?? "BAD_REQUEST";
    return NextResponse.json({ error: { code } }, { status: 400 });
  }

  try {
    await changePassword(session.user.id!, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (code === "USER_NOT_FOUND") {
      return NextResponse.json({ error: { code } }, { status: 404 });
    }
    return NextResponse.json({ error: { code } }, { status: 400 });
  }

  return NextResponse.json({ data: { success: true } });
}
