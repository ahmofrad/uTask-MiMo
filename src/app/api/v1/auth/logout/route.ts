import { signOut } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export async function POST() {
  await signOut({ redirect: false });
  return NextResponse.json({ data: { success: true } });
}
