import type { ZodType } from "zod";
import { z } from "zod";
import { getEndpoints } from "./registry";
import {
  ErrorResponse,
  UserSchema,
  ProjectSchema,
  TaskSchema,
  CommentSchema,
  TokenSchema,
  WebhookSchema,
} from "./schemas";

type OpenApiSchema = Record<string, unknown>;

const SCHEMA_MAP: Record<string, string> = {
  "/tasks": "Task",
  "/tasks/{id}": "Task",
  "/tasks/{id}/comments": "Comment",
  "/projects": "Project",
  "/projects/{id}": "Project",
  "/users": "User",
  "/users/{id}": "User",
  "/me": "User",
  "/tokens": "Token",
  "/webhooks": "Webhook",
  "/webhook-deliveries": "Webhook",
};

const ZOD_MAP: Record<string, ZodType<unknown>> = {
  ErrorResponse,
  User: UserSchema,
  Project: ProjectSchema,
  Task: TaskSchema,
  Comment: CommentSchema,
  Token: TokenSchema,
  Webhook: WebhookSchema,
};

function zodToOpenApi(schema: ZodType<unknown>): Record<string, unknown> {
  if (schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: "string" };
    const def = schema._def as unknown as { checks?: Array<{ kind: string; value?: unknown }> };
    const checks = def.checks ?? [];
    for (const check of checks) {
      if (check.kind === "email") result.format = "email";
      if (check.kind === "uuid") result.format = "uuid";
      if (check.kind === "url") result.format = "uri";
      if (check.kind === "datetime") result.format = "date-time";
      if (check.kind === "min") result.minLength = check.value;
      if (check.kind === "max") result.maxLength = check.value;
    }
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: Record<string, unknown> = { type: "number" };
    const def = schema._def as unknown as { checks?: Array<{ kind: string; value?: unknown }> };
    const checks = def.checks ?? [];
    for (const check of checks) {
      if (check.kind === "min") result.minimum = check.value;
      if (check.kind === "max") result.maximum = check.value;
    }
    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }

  if (schema instanceof z.ZodNull) {
    return { type: "null" };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToOpenApi(schema.element as ZodType<unknown>),
    };
  }

  if (schema instanceof z.ZodObject) {
    const rawShape = (schema._def as unknown as { shape: Record<string, unknown> | (() => Record<string, unknown>) }).shape;
    const shape = typeof rawShape === "function" ? rawShape() : rawShape;
    const properties: Record<string, OpenApiSchema> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as ZodType<unknown>;
      properties[key] = zodToOpenApi(zodValue);
      if (!(zodValue instanceof z.ZodOptional) && !(zodValue instanceof z.ZodNullable)) {
        required.push(key);
      }
    }
    return { type: "object", properties, required };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: (schema._def as unknown as { values: string[] }).values };
  }

  if (schema instanceof z.ZodNullable) {
    const inner = zodToOpenApi(schema.unwrap() as ZodType<unknown>);
    return { ...inner, nullable: true };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToOpenApi(schema.unwrap() as ZodType<unknown>);
  }

  return {};
}

export function zodToOpenApiSchema(schema: ZodType<unknown>): Record<string, unknown> {
  return zodToOpenApi(schema);
}

export function generateOpenApiSpec(): Record<string, unknown> {
  const schemas: Record<string, Record<string, unknown>> = {};
  for (const [name, zodSchema] of Object.entries(ZOD_MAP)) {
    schemas[name] = zodToOpenApi(zodSchema);
  }

  const paths: Record<string, Record<string, unknown>> = {};

  for (const entry of getEndpoints()) {
    const pathItem = paths[entry.path] ?? {};
    const method = entry.method.toLowerCase();
    const responseSchema = SCHEMA_MAP[entry.path] ?? "ErrorResponse";

    const operation: Record<string, unknown> = {
      summary: entry.summary,
      tags: [entry.path.split("/")[1] ?? "default"],
      security: entry.security.length > 0 ? [{ bearerAuth: entry.security }] : [],
      parameters: entry.parameters?.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        schema: p.schema,
        description: p.description,
      })) ?? [],
      responses: {
        "200": {
          description: "Success",
          content: { "application/json": { schema: { $ref: `#/components/schemas/${responseSchema}` } } },
        },
        "400": { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
    };
    if (entry.requestBody) {
      operation.requestBody = entry.requestBody;
    }
    pathItem[method] = operation;
    paths[entry.path] = pathItem;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "uTask Public API",
      version: "2024-12-01",
      description: "REST API for uTask task management platform. All endpoints require a Bearer token obtained from the Tokens section of the UI.",
    },
    servers: [{ url: "/api/v1/public" }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "tk_",
          description: "API token with prefix tk_",
        },
      },
      schemas,
    },
  };
}
