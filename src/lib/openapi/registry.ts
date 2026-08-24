interface EndpointEntry {
  method: string;
  path: string;
  summary: string;
  security: string[];
  responseSchema?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema: { type: string };
    description?: string;
  }>;
  requestBody?: Record<string, unknown>;
}

const endpoints: EndpointEntry[] = [
  {
    method: "GET",
    path: "/tasks",
    summary: "List tasks",
    security: ["tasks:read"],
    responseSchema: "Task",
    parameters: [
      { name: "cursor", in: "query", schema: { type: "string" } },
      { name: "limit", in: "query", schema: { type: "integer" } },
      { name: "projectId", in: "query", schema: { type: "string" } },
      { name: "assigneeId", in: "query", schema: { type: "string" }, description: "Filter by a single assignee (alias for assigneeIds with one id)" },
      { name: "assigneeIds", in: "query", schema: { type: "string" }, description: "Comma-separated user ids; task must have at least one of them assigned" },
    ],
  },
  {
    method: "POST",
    path: "/tasks",
    summary: "Create task",
    security: ["tasks:write"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
              assigneeIds: { type: "array", items: { type: "string" } },
              dueDate: { type: "string", format: "date-time" },
            },
            required: ["projectId", "title"],
          },
        },
      },
    },
  },
  {
    method: "GET",
    path: "/tasks/{id}",
    summary: "Get task",
    security: ["tasks:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "PATCH",
    path: "/tasks/{id}",
    summary: "Update task",
    security: ["tasks:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
              priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
              assigneeIds: { type: "array", items: { type: "string" } },
              dueDate: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  },
  {
    method: "DELETE",
    path: "/tasks/{id}",
    summary: "Delete task",
    security: ["tasks:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "GET",
    path: "/tasks/{id}/comments",
    summary: "List comments",
    security: ["tasks:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "POST",
    path: "/tasks/{id}/comments",
    summary: "Create comment",
    security: ["comments:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              bodyMarkdown: { type: "string" },
              parentCommentId: { type: "string" },
            },
            required: ["bodyMarkdown"],
          },
        },
      },
    },
  },
  {
    method: "GET",
    path: "/projects",
    summary: "List projects",
    security: ["projects:read"],
  },
  {
    method: "POST",
    path: "/projects",
    summary: "Create project",
    security: ["projects:write"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              visibility: { type: "string", enum: ["private", "department", "org"] },
            },
            required: ["name"],
          },
        },
      },
    },
  },
  {
    method: "GET",
    path: "/projects/{id}",
    summary: "Get project",
    security: ["projects:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "PATCH",
    path: "/projects/{id}",
    summary: "Update project",
    security: ["projects:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              visibility: { type: "string", enum: ["private", "department", "org"] },
              status: { type: "string", enum: ["active", "archived"] },
            },
          },
        },
      },
    },
  },
  {
    method: "GET",
    path: "/users",
    summary: "List users",
    security: ["users:read"],
  },
  {
    method: "GET",
    path: "/users/{id}",
    summary: "Get user",
    security: ["users:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "GET",
    path: "/me",
    summary: "Current user info",
    security: [],
  },
  {
    method: "GET",
    path: "/tokens",
    summary: "List my tokens",
    security: [],
  },
  {
    method: "POST",
    path: "/tokens",
    summary: "Create token",
    security: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              scopes: { type: "array", items: { type: "string" } },
              expiresAt: { type: "string", format: "date-time" },
            },
            required: ["name", "scopes"],
          },
        },
      },
    },
  },
  {
    method: "DELETE",
    path: "/tokens/{id}",
    summary: "Revoke token",
    security: [],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "GET",
    path: "/webhooks",
    summary: "List webhooks",
    security: ["webhooks:manage"],
  },
  {
    method: "POST",
    path: "/webhooks",
    summary: "Create webhook",
    security: ["webhooks:manage"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              url: { type: "string", format: "uri" },
              events: { type: "array", items: { type: "string" } },
            },
            required: ["name", "url", "events"],
          },
        },
      },
    },
  },
  {
    method: "PATCH",
    path: "/webhooks/{id}",
    summary: "Update webhook",
    security: ["webhooks:manage"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              url: { type: "string", format: "uri" },
              events: { type: "array", items: { type: "string" } },
              active: { type: "boolean" },
            },
          },
        },
      },
    },
  },
  {
    method: "DELETE",
    path: "/webhooks/{id}",
    summary: "Delete webhook",
    security: ["webhooks:manage"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "GET",
    path: "/webhook-deliveries",
    summary: "List deliveries",
    security: ["webhooks:manage"],
    parameters: [
      { name: "webhookId", in: "query", schema: { type: "string" } },
      { name: "cursor", in: "query", schema: { type: "string" } },
    ],
  },
  // ── Baselines & EVM ──
  {
    method: "GET",
    path: "/projects/{id}/baselines",
    summary: "List project baselines",
    security: ["projects:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "POST",
    path: "/projects/{id}/baselines",
    summary: "Capture project baseline",
    security: ["projects:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
    },
  },
  {
    method: "GET",
    path: "/projects/{id}/evm",
    summary: "Get EVM metrics",
    security: ["projects:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  // ── Risk Register ──
  {
    method: "GET",
    path: "/projects/{id}/risks",
    summary: "List project risks",
    security: ["projects:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "POST",
    path: "/projects/{id}/risks",
    summary: "Create risk record",
    security: ["projects:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              probability: { type: "string", enum: ["low", "medium", "high"] },
              impact: { type: "string", enum: ["low", "medium", "high"] },
              response: { type: "string", enum: ["mitigate", "accept", "transfer", "avoid"] },
              ownerId: { type: "string" },
            },
            required: ["title", "probability", "impact"],
          },
        },
      },
    },
  },
  // ── Change Requests ──
  {
    method: "GET",
    path: "/projects/{id}/change-requests",
    summary: "List change requests",
    security: ["projects:read"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  },
  {
    method: "POST",
    path: "/projects/{id}/change-requests",
    summary: "Create change request",
    security: ["projects:write"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              reference: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
    },
  },
  // ── Automation Rules ──
  {
    method: "GET",
    path: "/automation/rules",
    summary: "List automation rules",
    security: ["projects:read"],
    parameters: [
      { name: "projectId", in: "query", schema: { type: "string" } },
    ],
  },
  {
    method: "POST",
    path: "/automation/rules",
    summary: "Create automation rule",
    security: ["projects:write"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              name: { type: "string" },
              trigger: { type: "string", enum: ["STATUS_CHANGED", "PRIORITY_CHANGED", "ASSIGNMENT_ADDED", "COMMENT_ADDED", "DUE_DATE_APPROACHING"] },
              conditions: { type: "array", items: { type: "object" } },
              actions: { type: "array", items: { type: "object" } },
            },
            required: ["name", "trigger", "conditions", "actions"],
          },
        },
      },
    },
  },
];

export function getEndpoints(): EndpointEntry[] {
  return endpoints;
}
