# Webhook Integration Guide

> Receive real-time event notifications from TaskApp in your own services.

## Table of Contents

1. [Overview](#1-overview)
2. [Subscribing to Events](#2-subscribing-to-events)
3. [Delivery Format](#3-delivery-format)
4. [Signature Verification](#4-signature-verification)
5. [Event Reference](#5-event-reference)
6. [Retry & Dead-Letter](#6-retry--dead-letter)
7. [Best Practices](#7-best-practices)
8. [Code Examples](#8-code-examples)
9. [Deliveries & Replay](#9-deliveries--replay)
10. [Security](#10-security)

---

## 1. Overview

Webhooks allow your services to receive real-time notifications when events happen in TaskApp. When an event occurs, TaskApp sends an HTTP POST request with a JSON payload to the URL(s) you configure.

### Key Characteristics

- **HMAC-SHA256 signed** — every payload includes a signature header for verification.
- **Automatic retry** — failed deliveries retry with exponential backoff (up to 5 attempts).
- **Dead-letter** — permanently failed deliveries are preserved for inspection and replay.
- **SSRF protected** — webhook URLs must be HTTPS and cannot point to private/internal networks (configurable per webhook).

---

## 2. Subscribing to Events

### 2.1 Creating a Webhook

Webhooks are managed in the **Admin → Webhooks** panel.

1. Click **New Webhook**.
2. Enter a **Name** (e.g., "Slack Notifications").
3. Enter the **Target URL** (must be HTTPS).
4. Select the **Events** to subscribe to (one or more).
5. A **Secret** is auto-generated — copy it immediately. It is shown only once.

### 2.2 Available Events

| Event | Trigger |
|-------|---------|
| `task.created` | A new task is created |
| `task.updated` | A task is updated (title, status, priority, assignee, etc.) |
| `task.deleted` | A task is soft-deleted |
| `task.assigned` | A task is assigned (or reassigned) to a user |
| `task.status_changed` | A task's status changes |
| `comment.created` | A comment is added to a task |
| `project.created` | A new project is created |
| `project.updated` | A project is updated |
| `custom_field.updated` | A custom field schema is modified |

### 2.3 Updating a Webhook

You can modify the name, URL, subscribed events, and active status from the admin panel. The secret cannot be changed — create a new webhook if you need to rotate the secret.

### 2.4 Testing a Webhook

Click **Test** on the webhook detail page. A synthetic `webhook.test` event is sent to the URL. Use this to verify your receiver is working correctly before subscribing to real events.

---

## 3. Delivery Format

### 3.1 Request

TaskApp delivers webhooks as HTTP POST requests:

```
POST <your-webhook-url>
Content-Type: application/json
User-Agent: TaskApp-Webhooks/1.0
X-TaskApp-Event-Id: evt_<uuid>
X-TaskApp-Event-Type: task.created
X-TaskApp-Delivery-Id: <delivery-uuid>
X-TaskApp-Signature: sha256=<hex>
X-TaskApp-Timestamp: <unix-seconds>
```

### 3.2 Payload Envelope

```json
{
  "id": "evt_<uuid>",
  "type": "task.created",
  "createdAt": "2026-07-04T12:00:00.000Z",
  "apiVersion": "2024-12-01",
  "actor": {
    "id": "<user-uuid>",
    "type": "user"
  },
  "data": {
    "id": "<task-uuid>",
    "title": "Fix login bug",
    "status": "open",
    "priority": "high",
    "projectId": "<project-uuid>",
    "assigneeId": "<user-uuid>",
    "createdAt": "2026-07-04T12:00:00.000Z",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

### 3.3 Headers Explained

| Header | Description | Example |
|--------|-------------|---------|
| `X-TaskApp-Event-Id` | Unique event identifier (same for all deliveries of this event) | `evt_a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `X-TaskApp-Event-Type` | The event type | `task.created` |
| `X-TaskApp-Delivery-Id` | Unique delivery attempt ID (changes on retry) | `clx...` |
| `X-TaskApp-Signature` | HMAC-SHA256 of the request body (used to verify authenticity) | `sha256=abc123def456...` |
| `X-TaskApp-Timestamp` | Unix timestamp when this delivery was dispatched | `1749043200` |

---

## 4. Signature Verification

Every webhook payload is signed with HMAC-SHA256 using the webhook's secret. **You must verify the signature** before processing the payload to ensure it came from TaskApp and has not been tampered with.

### 4.1 Verification Algorithm

```
expected = HMAC-SHA256(secret, raw-request-body)
signature = "sha256=" + hex-encode(expected)
compare signature against X-TaskApp-Signature header
```

**Important:** Use the raw request body, not the parsed JSON object. The body may be stringified differently by your JSON parser, which would produce a different signature.

### 4.2 Timing-Safe Comparison

Always use a constant-time comparison function to prevent timing attacks:

```typescript
import crypto from "node:crypto";

function verifySignature(
  secret: string,
  body: string,
  signatureHeader: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf-8")
    .digest("hex");

  const expectedSig = `sha256=${expected}`;

  // Timing-safe comparison
  if (expectedSig.length !== signatureHeader.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSig, "utf-8"),
    Buffer.from(signatureHeader, "utf-8")
  );
}
```

### 4.3 Replay Attack Prevention

The `X-TaskApp-Timestamp` header can be used to prevent replay attacks:

1. Verify the signature.
2. Check that the timestamp is within your tolerance window (e.g., 5 minutes).
3. Optionally track processed `X-TaskApp-Event-Id` values to reject duplicates.

```typescript
function isTimestampValid(timestampHeader: string, toleranceSeconds = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const timestamp = parseInt(timestampHeader, 10);
  return Math.abs(now - timestamp) <= toleranceSeconds;
}
```

---

## 5. Event Reference

### 5.1 `task.created`

Triggered when a new task is created.

```json
{
  "id": "evt_<uuid>",
  "type": "task.created",
  "createdAt": "2026-07-04T12:00:00.000Z",
  "actor": { "id": "<user-id>", "type": "user" },
  "data": {
    "id": "<task-id>",
    "title": "Fix login bug",
    "description": "Users cannot log in after password reset",
    "status": "open",
    "priority": "high",
    "projectId": "<project-id>",
    "assigneeId": "<user-id>",
    "dueDate": "2026-07-10T00:00:00.000Z",
    "tags": ["bug", "auth"],
    "createdAt": "2026-07-04T12:00:00.000Z"
  }
}
```

### 5.2 `task.updated`

Triggered when a task is modified. The data object contains the full task after the update.

**Notable:** This event fires for any field change — status, priority, assignee, title, description, tags, custom fields. For assignee and status changes, also see the specific events below.

### 5.3 `task.deleted`

Triggered when a task is soft-deleted.

```json
{
  "id": "evt_<uuid>",
  "type": "task.deleted",
  "createdAt": "2026-07-04T12:00:00.000Z",
  "actor": { "id": "<user-id>", "type": "user" },
  "data": {
    "id": "<task-id>",
    "title": "Fix login bug",
    "deletedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

### 5.4 `task.assigned`

Triggered when a task is assigned or reassigned. Fires **in addition to** `task.updated`.

```json
{
  "id": "evt_<uuid>",
  "type": "task.assigned",
  "createdAt": "2026-07-04T12:00:00.000Z",
  "actor": { "id": "<user-id>", "type": "user" },
  "data": {
    "id": "<task-id>",
    "title": "Fix login bug",
    "assigneeId": "<new-assignee-id>",
    "previousAssigneeId": "<old-assignee-id>"
  }
}
```

### 5.5 `task.status_changed`

Triggered when a task's status changes. Fires **in addition to** `task.updated`.

```json
{
  "id": "evt_<uuid>",
  "type": "task.status_changed",
  "createdAt": "2026-07-04T12:00:00.000Z",
  "actor": { "id": "<user-id>", "type": "user" },
  "data": {
    "id": "<task-id>",
    "title": "Fix login bug",
    "status": "done",
    "previousStatus": "in_progress"
  }
}
```

### 5.6 `comment.created`

Triggered when a comment is added to a task.

```json
{
  "id": "evt_<uuid>",
  "type": "comment.created",
  "createdAt": "2026-07-04T12:30:00.000Z",
  "actor": { "id": "<user-id>", "type": "user" },
  "data": {
    "id": "<comment-id>",
    "body": "I fixed this with a hotfix. **Markdown** is supported.",
    "taskId": "<task-id>",
    "parentId": null,
    "createdAt": "2026-07-04T12:30:00.000Z"
  }
}
```

### 5.7 `project.created`

Triggered when a new project is created.

```json
{
  "id": "evt_<uuid>",
  "type": "project.created",
  "createdAt": "2026-07-04T12:00:00.000Z",
  "actor": { "id": "<user-id>", "type": "user" },
  "data": {
    "id": "<project-id>",
    "name": "Website Redesign",
    "visibility": "public",
    "createdAt": "2026-07-04T12:00:00.000Z"
  }
}
```

### 5.8 `project.updated`

Triggered when a project is modified (name, description, visibility, members).

### 5.9 `custom_field.updated`

Triggered when a custom field schema is created, modified, or archived in a project.

---

## 6. Retry & Dead-Letter

### 6.1 Retry Schedule

If your endpoint returns a non-2xx status (or does not respond within 10 seconds), TaskApp retries the delivery:

| Attempt | Delay |
|---------|-------|
| 1 | Initial attempt |
| 2 | 5 seconds |
| 3 | 10 seconds |
| 4 | 20 seconds |
| 5 | 40 seconds |
| 6 | 80 seconds |
| (dead-letter) | — |

### 6.2 What Triggers a Retry

- HTTP status ≥ 300 (any non-2xx response).
- Network error (DNS failure, connection refused, TLS error).
- Timeout (endpoint does not respond within 10 seconds).

### 6.3 What Succeeds Immediately

- HTTP status 200 OK.
- HTTP status 201 Created.
- HTTP status 202 Accepted.
- HTTP status 204 No Content.

### 6.4 Dead-Letter

After 5 failed retry attempts (6 total attempts), the delivery is moved to the **dead-letter** queue. Dead-lettered deliveries are preserved indefinitely and can be:

- **Inspected** — view the request and response details.
- **Replayed** — re-send the exact same payload to the webhook URL.

### 6.5 Delivery Log

Each delivery attempt is recorded in the delivery log (accessible from the webhook detail page):

| Field | Description |
|-------|-------------|
| Status code | HTTP response status |
| Response body | Truncated to 10,000 characters |
| Duration | Request round-trip time |
| Error | Error message (for network failures) |
| Attempt | Attempt number (1-based) |
| Scheduled at | When the delivery was scheduled |
| Delivered at | When the request completed |

---

## 7. Best Practices

### 7.1 Always Verify Signatures

Never process a webhook payload without verifying the HMAC signature. This is your only guarantee that the payload came from TaskApp and has not been modified.

### 7.2 Respond Quickly

Return a 2xx status as fast as possible. The delivery worker has a 10-second timeout. If you need to do heavy processing (e.g., sending a Slack message, updating a database), acknowledge the webhook first and process asynchronously:

```
1. Receive webhook → verify signature → return 200 OK
2. Queue the event in your own system for processing
3. Process asynchronously
```

### 7.3 Idempotency

Use the `X-TaskApp-Event-Id` header for idempotency. The same event may be delivered more than once (e.g., if your endpoint returns 200 but the connection drops before TaskApp receives the response). Deduplicate by event ID:

```typescript
const processedEvents = new Set<string>();

function handleWebhook(eventId: string, payload: any) {
  if (processedEvents.has(eventId)) {
    return; // Already processed
  }
  processedEvents.add(eventId);
  // Process the event
}
```

### 7.4 Use HTTPS

TaskApp only delivers webhooks to HTTPS URLs (SSRF protection). Ensure your endpoint uses a valid TLS certificate.

### 7.5 Monitor Failed Deliveries

- Regularly check the dead-letter queue for stuck deliveries.
- Set up alerts on webhook delivery failure rate (the Prometheus alert `WebhookDeliveryHighFailureRate` fires when >10% of deliveries fail in 5 minutes).

### 7.6 Rotate Secrets

Create a new webhook (with a new secret) and update your receiver, then delete the old webhook. Secrets cannot be changed on existing webhooks.

---

## 8. Code Examples

### 8.1 Node.js / Express

```typescript
import express from "express";
import crypto from "node:crypto";

const app = express();

// IMPORTANT: Use raw body for signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf-8");
    },
  })
);

const WEBHOOK_SECRET = process.env.TASKAPP_WEBHOOK_SECRET!;

function verifySignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody, "utf-8")
    .digest("hex");

  const expectedSig = `sha256=${expected}`;

  if (expectedSig.length !== signatureHeader.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSig, "utf-8"),
    Buffer.from(signatureHeader, "utf-8")
  );
}

// Track processed events for idempotency
const processedEvents = new Set<string>();

app.post("/webhooks/taskapp", (req, res) => {
  // 1. Verify signature
  const signature = req.headers["x-taskapp-signature"] as string;
  if (!signature || !verifySignature(req.rawBody, signature)) {
    console.error("Invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 2. Check timestamp (replay protection)
  const timestamp = parseInt(
    req.headers["x-taskapp-timestamp"] as string,
    10
  );
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.error("Timestamp too old");
    return res.status(401).json({ error: "Timestamp too old" });
  }

  // 3. Idempotency check
  const eventId = req.headers["x-taskapp-event-id"] as string;
  if (processedEvents.has(eventId)) {
    return res.status(200).json({ status: "duplicate" });
  }

  // 4. Process event
  const event = req.body;
  console.log(`Received ${event.type}:`, event.data.id);

  // Acknowledge immediately
  res.status(200).json({ status: "ok" });

  // Process asynchronously
  setImmediate(() => {
    switch (event.type) {
      case "task.created":
        handleTaskCreated(event.data);
        break;
      case "task.updated":
        handleTaskUpdated(event.data);
        break;
      case "comment.created":
        handleCommentCreated(event.data);
        break;
    }
    processedEvents.add(eventId);
  });
});

function handleTaskCreated(task: any) {
  // Your logic here
  console.log(`New task: ${task.title}`);
}

function handleTaskUpdated(task: any) {
  console.log(`Task updated: ${task.title} -> ${task.status}`);
}

function handleCommentCreated(comment: any) {
  console.log(`New comment on task ${comment.taskId}`);
}

app.listen(3001, () => {
  console.log("Webhook receiver listening on port 3001");
});
```

### 8.2 Python / Flask

```python
import hmac
import hashlib
import time
from flask import Flask, request, jsonify

app = Flask(__name__)

WEBHOOK_SECRET = "the-webhook-secret-from-admin-panel"

processed_events = set()

@app.route("/webhooks/taskapp", methods=["POST"])
def handle_webhook():
    # 1. Get raw body
    raw_body = request.get_data()

    # 2. Verify signature
    signature = request.headers.get("X-TaskApp-Signature", "")
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    expected_sig = f"sha256={expected}"

    if not hmac.compare_digest(expected_sig, signature):
        return jsonify({"error": "Invalid signature"}), 401

    # 3. Check timestamp (replay protection)
    timestamp = int(request.headers.get("X-TaskApp-Timestamp", 0))
    if abs(time.time() - timestamp) > 300:
        return jsonify({"error": "Timestamp too old"}), 401

    # 4. Idempotency check
    event_id = request.headers.get("X-TaskApp-Event-Id", "")
    if event_id in processed_events:
        return jsonify({"status": "duplicate"}), 200

    # 5. Process
    event = request.json
    print(f"Received {event['type']}: {event['data']['id']}")

    # Acknowledge immediately, process async
    processed_events.add(event_id)

    if event["type"] == "task.created":
        handle_task_created(event["data"])
    elif event["type"] == "comment.created":
        handle_comment_created(event["data"])

    return jsonify({"status": "ok"}), 200

def handle_task_created(data):
    print(f"New task: {data['title']}")

def handle_comment_created(data):
    print(f"New comment on task {data['taskId']}")

if __name__ == "__main__":
    app.run(port=3001)
```

### 8.3 Go / net/http

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

var webhookSecret = "the-webhook-secret-from-admin-panel"

type Event struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	CreatedAt time.Time       `json:"createdAt"`
	APIVersion string         `json:"apiVersion"`
	Data      json.RawMessage `json:"data"`
}

func verifySignature(body []byte, signatureHeader string) bool {
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	expectedSig := "sha256=" + expected
	return hmac.Equal([]byte(expectedSig), []byte(signatureHeader))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	// Read raw body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Cannot read body", 400)
		return
	}
	defer r.Body.Close()

	// 1. Verify signature
	sig := r.Header.Get("X-TaskApp-Signature")
	if !verifySignature(body, sig) {
		http.Error(w, "Invalid signature", 401)
		return
	}

	// 2. Check timestamp
	ts := r.Header.Get("X-TaskApp-Timestamp")
	// Parse and validate timestamp...

	// 3. Parse event
	var event Event
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}

	// Acknowledge immediately
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

	// Process asynchronously
	go func() {
		log.Printf("Received %s: %s", event.Type, event.ID)
	}()
}
```

### 8.4 cURL Test (from your server)

Use this to simulate a webhook delivery for testing:

```bash
WEBHOOK_URL="https://your-receiver.com/webhooks/taskapp"
SECRET="the-webhook-secret"
TIMESTAMP=$(date +%s)

PAYLOAD='{
  "id": "evt_test123",
  "type": "webhook.test",
  "createdAt": "2026-07-04T12:00:00Z",
  "apiVersion": "2024-12-01",
  "actor": {"id": "test-user", "type": "user"},
  "data": {"message": "This is a test event"}
}'

SIGNATURE=$(echo -n "$PAYLOAD" | \
  openssl dgst -sha256 -hmac "$SECRET" | \
  awk '{print "sha256="$2}')

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-TaskApp-Event-Id: evt_test123" \
  -H "X-TaskApp-Event-Type: webhook.test" \
  -H "X-TaskApp-Delivery-Id: del_test123" \
  -H "X-TaskApp-Signature: $SIGNATURE" \
  -H "X-TaskApp-Timestamp: $TIMESTAMP" \
  -d "$PAYLOAD"
```

---

## 9. Deliveries & Replay

### 9.1 Viewing the Delivery Log

From the webhook detail page in the admin panel, click **Deliveries**. Each row shows:

- Event type and ID.
- Delivery status (success, pending, failed, dead-lettered).
- Response status code and body (truncated).
- Duration.
- Attempt number.

### 9.2 Replaying a Delivery

1. Navigate to the delivery in the delivery log.
2. Click **Replay**.
3. The exact same payload is re-sent to the webhook URL.
4. A new delivery attempt is created in the log.

Replay is useful when:

- Your receiver had a temporary outage.
- You fixed a bug in your receiver and want to re-process past events.

### 9.3 Testing with Synthetic Events

Click **Test** on the webhook detail page to send a synthetic `webhook.test` event. The payload is:

```json
{
  "id": "evt_<uuid>",
  "type": "webhook.test",
  "createdAt": "<now>",
  "apiVersion": "2024-12-01",
  "actor": { "id": "system", "type": "system" },
  "data": { "message": "Test event from TaskApp" }
}
```

---

## 10. Security

### 10.1 Signature Verification

Always verify the `X-TaskApp-Signature` header before processing. This ensures:

- The payload was sent by TaskApp (not an attacker).
- The payload has not been tampered with in transit.

### 10.2 Secret Storage

- The webhook secret is shown only once when the webhook is created.
- Store it securely in your environment variables or secrets manager.
- Never log or expose the secret in error messages.

### 10.3 SSRF Protection

TaskApp validates all webhook URLs against a private network blocklist:

- Blocks RFC 1918 private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Blocks loopback (`127.0.0.0/8`, `::1/128`).
- Blocks link-local (`169.254.0.0/16`).
- Blocks hostnames ending with `.local` or `.internal`.
- Requires HTTPS.

If you need to deliver webhooks to an internal service (e.g., a Slack bot running on your intranet), you can override the SSRF blocklist per webhook in the admin panel.

### 10.4 Replay Protection

Use the `X-TaskApp-Timestamp` header to detect and reject replay attacks:

- Set a reasonable tolerance window (e.g., 5 minutes).
- Reject events outside this window.

### 10.5 IP Allowlisting

TaskApp does not publish a fixed set of source IPs (delivery is performed by application instances, which may run anywhere). Instead, rely on **signature verification** to authenticate the sender.
