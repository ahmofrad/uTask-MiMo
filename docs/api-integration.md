# API Integration Guide

> Integrate third-party tools and automations with the TaskApp Public REST API.

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [API Tokens](#3-api-tokens)
4. [Making Requests](#4-making-requests)
5. [Rate Limiting](#5-rate-limiting)
6. [Pagination](#6-pagination)
7. [Errors](#7-errors)
8. [Endpoints Reference](#8-endpoints-reference)
9. [Code Examples](#9-code-examples)
10. [OpenAPI Spec & Swagger UI](#10-openapi-spec--swagger-ui)

---

## 1. Overview

Base URL: `https://your-instance/api/v1/public/`

All endpoints return JSON. Requests and responses use `Content-Type: application/json`.

The API is versioned from day 1. The current version is indicated in the response headers as `X-API-Version: 2024-12-01`.

### Key Characteristics

- Bearer token authentication.
- Per-token scope enforcement (RBAC is additive to the token user's role).
- Cursor-based pagination (no offset).
- Rate limited per token (60 requests/min).
- Every mutation creates an audit log entry.

---

## 2. Authentication

Include the API token in the `Authorization` header:

```
Authorization: Bearer tk_<base64url-token>
```

Tokens are issued per user and scoped to specific operations. The token's effective permissions are the **intersection** of the token's scopes and the user's RBAC role.

### Scopes Reference

| Scope | Endpoints | Description |
|-------|-----------|-------------|
| `tasks:read` | `GET /tasks`, `GET /tasks/:id`, `GET /tasks/:id/comments` | Read tasks and comments |
| `tasks:write` | `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id` | Create, update, delete tasks |
| `projects:read` | `GET /projects`, `GET /projects/:id`, `GET /projects/:id/custom-fields` | Read projects and their custom field schemas |
| `projects:write` | `POST /projects` | Create projects |
| `users:read` | `GET /users`, `GET /users/:id` | List users and view profiles |
| `users:write` | *(reserved)* | Create/update users |
| `comments:write` | `POST /tasks/:id/comments` | Add comments to tasks |
| `webhooks:manage` | *(public webhook endpoints — coming soon)* | Manage webhooks via API |
| `baselines:read` | `GET /projects/:id/baselines`, `GET /projects/:id/baselines/compare`, `GET /projects/:id/evm/series`, `GET /projects/:id/reports/variance` | Read baselines, EVM metrics, and variance reports |
| `baselines:write` | `POST /projects/:id/baselines`, `POST /projects/:id/baselines/:id/activate` | Capture and activate baselines |
| `risks:read` | `GET /projects/:id/risks`, `GET /projects/:id/risks/:riskId` | Read risk records |
| `risks:write` | `POST /projects/:id/risks`, `PATCH /projects/:id/risks/:riskId`, `DELETE /projects/:id/risks/:riskId` | Create, update, delete risk records |
| `change_requests:read` | `GET /projects/:id/change-requests`, `GET /projects/:id/change-requests/:crId` | Read change requests |
| `change_requests:write` | `POST /projects/:id/change-requests`, `POST /projects/:id/change-requests/:crId/submit`, `POST .../approve`, `POST .../reject`, `POST .../apply` | Create and manage change requests |
| `automation:read` | `GET /automation/rules`, `GET /automation/rules/:ruleId` | Read automation rules |
| `automation:write` | `POST /automation/rules`, `PATCH /automation/rules/:ruleId`, `DELETE /automation/rules/:ruleId` | Create, update, delete automation rules |

### Scope Check

Each endpoint declares its required scope. If the token lacks the scope, the API returns:

```json
{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "Token does not have the required scope: tasks:write"
  }
}
```

---

## 3. API Tokens

### 3.1 Creating a Token

Users create tokens from the **Settings → API Tokens** page in the web UI. The raw token is shown **once** on creation:

```
tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfGhijKlmnOpQRSTUv
```

Store it securely. It cannot be retrieved later.

### 3.2 Token Format

- **Prefix:** `tk_`
- **Payload:** 32 cryptographically random bytes, base64url-encoded.
- **Example:** `tk_<32-bytes-base64url>`
- **Display prefix:** First 4 characters after `tk_` are shown in the UI for identification (e.g., `tk_abcD`).

### 3.3 Hash at Rest

Tokens are stored as SHA-256 hex digests. The application never stores the raw token. If you lose a token, revoke it and create a new one.

### 3.4 Revoking a Token

Revoke a token from **Settings → API Tokens** → **Revoke**. The token is immediately invalidated. Revocation is permanent.

### 3.5 Token Expiry

Tokens can optionally have an expiry date (set during creation). Expired tokens return 401. Default: no expiry.

### 3.6 Self-Service Token API

Authenticated users can manage their own tokens via the API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/public/tokens` | List own tokens (without raw token) |
| `POST` | `/api/v1/public/tokens` | Create a new token (returns raw token once) |
| `DELETE` | `/api/v1/public/tokens/:id` | Revoke a token |

**Request body** (POST):

```json
{
  "name": "CI Pipeline",
  "scopes": ["tasks:read", "tasks:write"],
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response** (POST):

```json
{
  "data": {
    "id": "clx...",
    "name": "CI Pipeline",
    "prefix": "tk_abcD",
    "scopes": ["tasks:read", "tasks:write"],
    "expiresAt": "2026-12-31T23:59:59Z",
    "token": "tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfGhijKlmnOpQRSTUv",
    "createdAt": "2026-07-04T12:00:00.000Z"
  }
}
```

> **Important:** The `token` field is only returned on creation. Store it immediately.

---

## 4. Making Requests

### 4.1 Base URL

All requests go to:

```
https://your-instance/api/v1/public/
```

### 4.2 Headers

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | Yes | `Bearer <token>` |
| `Content-Type` | For POST/PATCH | `application/json` |

### 4.3 Response Format

Success responses use the `{ "data": ... }` wrapper:

```json
{
  "data": {
    "id": "clx...",
    "title": "Fix login bug",
    "status": "open",
    "priority": "high",
    "projectId": "clx...",
    "assigneeId": "clx...",
    "dueDate": "2026-07-10T00:00:00.000Z",
    "createdAt": "2026-07-04T12:00:00.000Z",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

List responses include pagination metadata:

```json
{
  "data": [ /* items */ ],
  "nextCursor": "eyJpZCI6ImNseC4uLiJ9",
  "hasMore": true
}
```

### 4.4 List Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | Cursor for pagination (from previous response's `nextCursor`) |
| `limit` | integer | 50 | Max items per page (max 200) |
| `filter[...]` | object | — | Field filters (varies by endpoint) |

---

## 5. Rate Limiting

### 5.1 Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Per API token | 60 requests | 60 seconds (rolling) |

### 5.2 Rate Limit Headers

Every authenticated response includes:

| Header | Example | Description |
|--------|---------|-------------|
| `X-RateLimit-Limit` | `60` | Max requests per window |
| `X-RateLimit-Remaining` | `42` | Remaining requests |
| `X-RateLimit-Reset` | `1749043200` | Unix timestamp when the window resets |

### 5.3 Rate Limited Response (429)

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again later."
  }
}
```

### 5.4 Handling Rate Limits

- Respect the `X-RateLimit-Remaining` header.
- Back off until `X-RateLimit-Reset` if you hit the limit.
- Batch list operations by requesting more items per page (`?limit=200`).
- If you consistently need higher limits, create multiple tokens and distribute requests.

### 5.5 Multi-Instance Deployments

Rate limiting is in-memory by default. For multi-instance deployments, configure Redis-backed rate limiting (see deployment documentation).

---

## 6. Pagination

All list endpoints use **cursor-based pagination** (no offset).

### 6.1 First Request

```
GET /api/v1/public/tasks?limit=50
```

### 6.2 Response

```json
{
  "data": [ /* up to 50 items */ ],
  "nextCursor": "eyJpZCI6ImNseC4uLiJ9",
  "hasMore": true
}
```

- `nextCursor`: opaque cursor string. Pass this as the `cursor` parameter on the next request.
- `hasMore`: `false` when there are no more pages.

### 6.3 Next Page

```
GET /api/v1/public/tasks?cursor=eyJpZCI6ImNseC4uLiJ9&limit=50
```

### 6.4 Notes

- Cursors are stable within a session but may change between requests if data is inserted/deleted.
- The cursor encodes the last item's ID — new items inserted after your current position will appear on the next page.
- There is no `total` or `page` count. Use `hasMore` to determine if there are more results.

---

## 7. Errors

### 7.1 Error Format

All errors follow RFC 7807 (Problem Details):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "field": "title",
    "details": "Title is required"
  }
}
```

### 7.2 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Validation error — check `field` and `details` |
| 401 | Missing or invalid token |
| 403 | Insufficient scope or RBAC permission |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate project name) |
| 429 | Rate limited |
| 5xx | Server error — check server logs with the `requestId` |

### 7.3 Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed (check `field` and `details`) |
| `INSUFFICIENT_SCOPE` | Token scope does not include the required scope |
| `INSUFFICIENT_PERMISSIONS` | User RBAC role does not permit the action |
| `NOT_FOUND` | Resource does not exist |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unexpected server error |

### 7.4 Request ID

Every error response includes a `requestId` in the response headers. Include this when reporting issues.

---

## 8. Endpoints Reference

### 8.1 Identity

#### `GET /me`

Returns the current token owner's profile and role.

**Scope:** none (authenticated token only).

**Response:**

```json
{
  "data": {
    "id": "clx...",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "manager",
    "departmentId": "clx...",
    "locale": "en-US",
    "accent": "blue"
  }
}
```

---

### 8.2 Tasks

#### `GET /tasks`

List tasks with optional filters.

**Scope:** `tasks:read`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer | Max 200 |
| `filter[projectId]` | UUID | Filter by project |
| `filter[assigneeId]` | UUID | Filter by assignee |
| `filter[status]` | string | `open`, `in_progress`, `done`, `cancelled` |
| `filter[priority]` | string | `none`, `low`, `medium`, `high`, `urgent` |

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Fix login bug",
      "description": "Users cannot log in after password reset",
      "status": "open",
      "priority": "high",
      "projectId": "clx...",
      "assigneeId": "clx...",
      "dueDate": "2026-07-10T00:00:00.000Z",
      "orderIndex": 1.0,
      "tags": ["bug", "auth"],
      "customFields": {
        "severity": "critical",
        "qa-needed": true
      },
      "createdAt": "2026-07-04T12:00:00.000Z",
      "updatedAt": "2026-07-04T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJpZCI6ImNseC4uLiJ9",
  "hasMore": true
}
```

#### `POST /tasks`

Create a new task.

**Scope:** `tasks:write`

**Request body:**

```json
{
  "title": "Fix login bug",
  "description": "Users cannot log in after password reset",
  "projectId": "clx...",
  "assigneeId": "clx...",
  "priority": "high",
  "dueDate": "2026-07-10T00:00:00.000Z",
  "tags": ["bug", "auth"],
  "customFields": {
    "severity": "critical"
  }
}
```

**Required:** `title`, `projectId`

**Response:** 201 + the created task.

#### `GET /tasks/:id`

Get a single task with details.

**Scope:** `tasks:read`

**Response:** 200 + task object.

#### `PATCH /tasks/:id`

Update a task (partial update — only send changed fields).

**Scope:** `tasks:write`

**Request body:** same shape as POST, all fields optional.

**Response:** 200 + updated task.

#### `DELETE /tasks/:id`

Soft-delete a task.

**Scope:** `tasks:write`

**Response:** 204 (no body).

---

### 8.3 Comments

#### `GET /tasks/:id/comments`

List comments for a task.

**Scope:** `tasks:read`

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "body": "I can reproduce this. **Markdown** works here.",
      "authorId": "clx...",
      "authorName": "Alice",
      "parentId": null,
      "createdAt": "2026-07-04T12:00:00.000Z",
      "updatedAt": "2026-07-04T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJpZCI6ImNseC4uLiJ9",
  "hasMore": true
}
```

#### `POST /tasks/:id/comments`

Add a comment to a task.

**Scope:** `comments:write`

**Request body:**

```json
{
  "body": "I can reproduce this. Mentioning @bob for help.",
  "parentId": null
}
```

`parentId` is optional — set to reply to an existing comment (threaded, max 3 levels).

**Response:** 201 + the created comment.

---

### 8.4 Projects

#### `GET /projects`

List projects.

**Scope:** `projects:read`

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Website Redesign",
      "description": "Q3 initiative",
      "visibility": "public",
      "ownerId": "clx...",
      "memberIds": ["clx...", "clx..."],
      "createdAt": "2026-07-01T00:00:00.000Z",
      "updatedAt": "2026-07-04T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJpZCI6ImNseC4uLiJ9",
  "hasMore": true
}
```

#### `POST /projects`

Create a project.

**Scope:** `projects:write`

**Request body:**

```json
{
  "name": "Website Redesign",
  "description": "Q3 initiative",
  "visibility": "public",
  "memberIds": ["clx..."]
}
```

**Required:** `name`

**Response:** 201 + the created project.

#### `GET /projects/:id`

Get a single project.

**Scope:** `projects:read`

**Response:** 200 + project object.

#### `GET /projects/:id/custom-fields`

List custom field schemas for a project.

**Scope:** `projects:read`

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "key": "severity",
      "name": "Severity",
      "type": "select",
      "required": true,
      "config": {
        "options": ["critical", "major", "minor", "trivial"]
      },
      "orderIndex": 0
    }
  ]
}
```

---

### 8.5 Users

#### `GET /users`

List active users.

**Scope:** `users:read`

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Alice",
      "email": "alice@example.com",
      "role": "manager",
      "departmentId": "clx...",
      "status": "active"
    }
  ],
  "nextCursor": "eyJpZCI6ImNseC4uLiJ9",
  "hasMore": true
}
```

#### `GET /users/:id`

Get a single user.

**Scope:** `users:read`

**Response:** 200 + user object.

---

### 8.6 Tokens (Self-Service)

#### `GET /tokens`

List own tokens.

**Scope:** none (authenticated user only).

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "CI Pipeline",
      "prefix": "tk_abcD",
      "scopes": ["tasks:read", "tasks:write"],
      "lastUsedAt": "2026-07-04T12:00:00.000Z",
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

#### `POST /tokens`

Create a new token. See §3.6 for request/response.

#### `DELETE /tokens/:id`

Revoke a token.

**Response:** 204 (no body).

---

## 9. Code Examples

### 9.1 cURL

```bash
# List tasks
curl -H "Authorization: Bearer tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfG" \
  https://your-instance/api/v1/public/tasks?limit=10

# Create a task
curl -X POST \
  -H "Authorization: Bearer tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfG" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","projectId":"clx..."}' \
  https://your-instance/api/v1/public/tasks

# Update a task
curl -X PATCH \
  -H "Authorization: Bearer tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfG" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}' \
  https://your-instance/api/v1/public/tasks/clx...

# Paginate through tasks
cursor=""
while true; do
  response=$(curl -s \
    -H "Authorization: Bearer $TOKEN" \
    "https://your-instance/api/v1/public/tasks?cursor=$cursor&limit=100")
  echo "$response" | jq '.data[]'
  cursor=$(echo "$response" | jq -r '.nextCursor // empty')
  has_more=$(echo "$response" | jq -r '.hasMore')
  [ "$has_more" = "false" ] && break
done
```

### 9.2 Node.js / TypeScript

```typescript
const API_TOKEN = "tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfG";
const BASE_URL = "https://your-instance/api/v1/public";

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`API error ${res.status}: ${err.error?.message}`);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// List tasks
const tasks = await request("GET", "/tasks?limit=50");
console.log(tasks.data);

// Create a task
const newTask = await request("POST", "/tasks", {
  title: "Fix login bug",
  projectId: "clx...",
  priority: "high",
});
console.log("Created:", newTask.data.id);

// Update a task
const updated = await request("PATCH", "/tasks/clx...", {
  status: "done",
});
console.log(updated.data);
```

### 9.3 Python

```python
import requests

API_TOKEN = "tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfG"
BASE_URL = "https://your-instance/api/v1/public"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}

# List tasks
resp = requests.get(f"{BASE_URL}/tasks", headers=headers, params={"limit": 10})
resp.raise_for_status()
data = resp.json()

for task in data["data"]:
    print(f"[{task['status']}] {task['title']}")

# Paginate
while data.get("hasMore"):
    cursor = data["nextCursor"]
    resp = requests.get(
        f"{BASE_URL}/tasks",
        headers=headers,
        params={"cursor": cursor, "limit": 10},
    )
    resp.raise_for_status()
    data = resp.json()
    for task in data["data"]:
        print(f"[{task['status']}] {task['title']}")

# Create a task
resp = requests.post(
    f"{BASE_URL}/tasks",
    headers=headers,
    json={
        "title": "Fix login bug",
        "projectId": "clx...",
        "priority": "high",
    },
)
resp.raise_for_status()
task = resp.json()["data"]
print(f"Created task: {task['id']}")

# Update
resp = requests.patch(
    f"{BASE_URL}/tasks/{task['id']}",
    headers=headers,
    json={"status": "done"},
)
```

### 9.4 Go

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const (
	apiToken = "tk_abcDefGHIJklmnOpQRSTuvWXyz0123456789abcdEfG"
	baseURL  = "https://your-instance/api/v1/public"
)

type Task struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Status   string `json:"status"`
	Priority string `json:"priority"`
}

type ListResponse struct {
	Data       []Task `json:"data"`
	NextCursor string `json:"nextCursor"`
	HasMore    bool   `json:"hasMore"`
}

func doRequest(method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

func listTasks(cursor string) (*ListResponse, error) {
	path := "/tasks?limit=10"
	if cursor != "" {
		path += "&cursor=" + cursor
	}
	resp, err := doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func createTask(title, projectID string) (*Task, error) {
	body, _ := json.Marshal(map[string]string{
		"title":     title,
		"projectId": projectID,
	})
	resp, err := doRequest("POST", "/tasks", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		Data Task `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result.Data, nil
}
```

### 9.5 Rate Limit Handling Pattern

```python
import time
import requests

def api_get(url, headers, params=None):
    while True:
        resp = requests.get(url, headers=headers, params=params)
        if resp.status_code == 429:
            reset = int(resp.headers.get("X-RateLimit-Reset", 0))
            sleep_time = max(reset - time.time(), 1)
            print(f"Rate limited. Sleeping {sleep_time}s...")
            time.sleep(sleep_time)
            continue
        resp.raise_for_status()
        return resp

def api_paginate(url, headers, params=None):
    data = []
    cursor = ""
    while True:
        p = dict(params or {})
        if cursor:
            p["cursor"] = cursor
        resp = api_get(url, headers, p)
        body = resp.json()
        data.extend(body["data"])
        if not body.get("hasMore"):
            break
        cursor = body["nextCursor"]
    return data
```

---

## 10. OpenAPI Spec & Swagger UI

### 10.1 OpenAPI 3.1 Spec

The complete API specification is available as an OpenAPI 3.1 document:

```
GET /api/v1/public/openapi.json
```

This is **generated** from the same Zod schemas used for request validation, so it is always in sync with the implementation.

### 10.2 Swagger UI

An interactive Swagger UI is available at:

```
GET /api/v1/public/docs
```

The Swagger UI is server-rendered (no client-side JavaScript leaks). You can explore endpoints, see request/response schemas, and test API calls directly from the browser.

### 10.3 Updating the Spec

The spec is auto-generated from the code. If you add a new endpoint or modify a schema, run:

```bash
pnpm build
```

The OpenAPI spec is regenerated during the build step.
