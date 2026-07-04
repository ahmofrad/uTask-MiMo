import { NextResponse } from "next/server";

export async function GET() {
  // TODO: generate and return SAML AuthnRequest redirect
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "SAML auth not yet implemented" } },
    { status: 501 },
  );
}
