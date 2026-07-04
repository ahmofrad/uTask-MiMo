const spec = {
  openapi: "3.1.0",
  info: {
    title: "uTask Public API",
    version: "2024-12-01",
    description: "Public REST API for uTask task management platform. Bearer token auth via `Authorization: Bearer <token>` header.",
  },
  servers: [{ url: "/api/v1/public" }],
  paths: {
    "/tasks": {
      get: {
        summary: "List tasks",
        security: [{ bearerAuth: ["tasks:read"] }],
        parameters: [
          { name: "cursor", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } },
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "assigneeId", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated list of tasks" } },
      },
      post: {
        summary: "Create task",
        security: [{ bearerAuth: ["tasks:write"] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { projectId: { type: "string" }, title: { type: "string" } }, required: ["projectId", "title"] } } },
        },
        responses: { "201": { description: "Created task" } },
      },
    },
    "/tasks/{id}": {
      get: { summary: "Get task", security: [{ bearerAuth: ["tasks:read"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Task details" } } },
      patch: { summary: "Update task", security: [{ bearerAuth: ["tasks:write"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated task" } } },
      delete: { summary: "Delete task", security: [{ bearerAuth: ["tasks:write"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/tasks/{id}/comments": {
      get: { summary: "List comments", security: [{ bearerAuth: ["tasks:read"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Comment list" } } },
      post: { summary: "Create comment", security: [{ bearerAuth: ["comments:write"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Created comment" } } },
    },
    "/projects": {
      get: { summary: "List projects", security: [{ bearerAuth: ["projects:read"] }], responses: { "200": { description: "Project list" } } },
      post: { summary: "Create project", security: [{ bearerAuth: ["projects:write"] }], responses: { "201": { description: "Created project" } } },
    },
    "/projects/{id}": {
      get: { summary: "Get project", security: [{ bearerAuth: ["projects:read"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Project details" } } },
    },
    "/users": {
      get: { summary: "List users", security: [{ bearerAuth: ["users:read"] }], responses: { "200": { description: "User list" } } },
    },
    "/users/{id}": {
      get: { summary: "Get user", security: [{ bearerAuth: ["users:read"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "User details" } } },
    },
    "/me": {
      get: { summary: "Current user info", security: [{ bearerAuth: [] }], responses: { "200": { description: "Current user" } } },
    },
    "/tokens": {
      get: { summary: "List my tokens", security: [{ bearerAuth: [] }], responses: { "200": { description: "Token list" } } },
      post: { summary: "Create token", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created token (shown once)" } } },
    },
    "/tokens/{id}": {
      delete: { summary: "Revoke token", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Revoked" } } },
    },
    "/webhooks": {
      get: { summary: "List webhooks", security: [{ bearerAuth: ["webhooks:manage"] }], responses: { "200": { description: "Webhook list" } } },
      post: { summary: "Create webhook", security: [{ bearerAuth: ["webhooks:manage"] }], responses: { "201": { description: "Created webhook with secret" } } },
    },
    "/webhooks/{id}": {
      patch: { summary: "Update webhook", security: [{ bearerAuth: ["webhooks:manage"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { summary: "Delete webhook", security: [{ bearerAuth: ["webhooks:manage"] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/webhook-deliveries": {
      get: { summary: "List deliveries", security: [{ bearerAuth: ["webhooks:manage"] }], parameters: [{ name: "webhookId", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Delivery list" } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "tk_",
        description: "API token with `tk_` prefix. Include required scopes.",
      },
    },
  },
};

export async function GET() {
  return Response.json(spec);
}
