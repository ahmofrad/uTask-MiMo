import { generateSpec } from "@/lib/openapi/spec";

export async function GET() {
  const spec = generateSpec();
  return Response.json(spec);
}
