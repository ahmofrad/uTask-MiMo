import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    data: {
      name: "uTask API",
      version: "2024-12-01",
      documentation: "/api/v1/public/docs",
    },
  });
}
