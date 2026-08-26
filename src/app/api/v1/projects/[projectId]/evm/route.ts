import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { computeEvm, snapshotEvm, getEvmSeries } from "@/lib/baselines";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const evmSchema = z.object({
  eacMethod: z.enum(["CPI_BASED", "SPI_BASED", "TCPI_BASED"]).optional().default("CPI_BASED"),
  currency: z.string().max(3).optional().default("USD"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const authResult = await requireAuth(request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const showSeries = url.searchParams.get("series") === "true";

  if (showSeries) {
    const series = await getEvmSeries(projectId);
    return NextResponse.json({ data: series });
  }

  const metrics = await computeEvm(projectId);
  return NextResponse.json({ data: metrics });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const authResult = await requireAuth(request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;

  const parsed = evmSchema.safeParse(await readJsonBody(request) ?? {});
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const snapshot = await snapshotEvm(projectId, parsed.data.eacMethod, parsed.data.currency);
  return NextResponse.json({ data: snapshot }, { status: 201 });
}
