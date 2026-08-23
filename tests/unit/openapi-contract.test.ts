import { describe, expect, it } from "vitest";
import { generateOpenApiSpec } from "@/lib/openapi/generator";
import { getEndpoints } from "@/lib/openapi/registry";

describe("public OpenAPI contract", () => {
  it("contains every registered operation with security and responses", () => {
    const spec = generateOpenApiSpec() as {
      paths: Record<string, Record<string, { security?: unknown; responses?: Record<string, unknown> }>>;
      components: { securitySchemes: Record<string, unknown> };
    };
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();

    for (const endpoint of getEndpoints()) {
      const operation = spec.paths[endpoint.path]?.[endpoint.method.toLowerCase()];
      expect(operation, `${endpoint.method} ${endpoint.path}`).toBeDefined();
      expect(operation?.responses?.["200"]).toBeDefined();
      expect(operation?.responses?.["400"]).toBeDefined();
      expect(operation?.security).toEqual(endpoint.security.length ? [{ bearerAuth: endpoint.security }] : []);
      for (const parameter of endpoint.parameters ?? []) {
        expect(operation?.responses).toBeDefined();
        const parameters = (operation as unknown as { parameters?: Array<{ name: string; in: string }> }).parameters ?? [];
        expect(parameters).toContainEqual(expect.objectContaining({ name: parameter.name, in: parameter.in }));
      }
    }
  });
});
