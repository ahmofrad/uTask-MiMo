import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "SAML callback not yet implemented" } },
    { status: 501 },
  );
}
