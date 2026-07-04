import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "LDAP auth not yet implemented" } },
    { status: 501 },
  );
}
