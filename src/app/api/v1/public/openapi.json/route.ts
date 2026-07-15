import { generateOpenApiSpec } from "@/lib/openapi/generator";

export async function GET() {
  const spec = generateOpenApiSpec();
  return Response.json(spec);
}
