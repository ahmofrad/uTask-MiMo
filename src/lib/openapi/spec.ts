import { getEndpoints } from "./registry";

export function generateSpec() {
  const endpoints = getEndpoints();

  const paths: Record<string, Record<string, unknown>> = {};
  for (const ep of endpoints) {
    if (!paths[ep.path]) {
      paths[ep.path] = {};
    }

    const operation: Record<string, unknown> = {
      summary: ep.summary,
      security: ep.security.length > 0
        ? [{ bearerAuth: ep.security }]
        : [],
    };

    if (ep.parameters) {
      operation.parameters = ep.parameters;
    }

    if (ep.requestBody) {
      operation.requestBody = ep.requestBody;
    }

    const responses: Record<string, unknown> = {
      "200": { description: "Success" },
      "400": { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
    };

    if (ep.method === "POST") {
      responses["201"] = { description: "Created" };
    }

    operation.responses = responses;

    paths[ep.path]![ep.method.toLowerCase()] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "uTask Public API",
      version: "2024-12-01",
      description: "Public REST API for uTask task management platform. Bearer token auth via `Authorization: Bearer <token>` header.",
    },
    servers: [{ url: "/api/v1/public" }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "tk_",
          description: "API token with `tk_` prefix. Include required scopes.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", description: "Machine-readable error code" },
                message: { type: "string", description: "Human-readable error message" },
                field: { type: "string", description: "Field that caused the error" },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            displayName: { type: "string" },
            avatarUrl: { type: "string", nullable: true },
            status: { type: "string", enum: ["active", "suspended"] },
            locale: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            visibility: { type: "string", enum: ["private", "department", "org"] },
            status: { type: "string", enum: ["active", "archived"] },
            ownerId: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
            priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
            projectId: { type: "string", format: "uuid" },
            assigneeIds: { type: "array", items: { type: "string", format: "uuid" } },
            dueDate: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            bodyMarkdown: { type: "string" },
            authorId: { type: "string", format: "uuid" },
            taskId: { type: "string", format: "uuid" },
            parentCommentId: { type: "string", format: "uuid", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Token: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            prefix: { type: "string" },
            scopes: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
            lastUsedAt: { type: "string", format: "date-time", nullable: true },
            expiresAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Webhook: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            url: { type: "string", format: "uri" },
            events: { type: "array", items: { type: "string" } },
            active: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
