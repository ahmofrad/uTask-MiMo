# Admin Guide

> For system administrators managing the TaskApp platform.

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [User Management](#2-user-management)
3. [Department Management](#3-department-management)
4. [Role-Based Access Control](#4-role-based-access-control)
5. [SSO Configuration](#5-sso-configuration)
6. [SMTP / Email Configuration](#6-smtp--email-configuration)
7. [Storage Configuration](#7-storage-configuration)
8. [API Token Management](#8-api-token-management)
9. [Webhook Management](#9-webhook-management)
10. [Audit Log](#10-audit-log)
11. [Settings](#11-settings)
12. [Backup & Restore](#12-backup--restore)
13. [Monitoring](#13-monitoring)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Getting Started

### 1.1 Accessing the Admin Panel

1. Log in with an **Owner** or **Admin** role account.
2. Navigate to `/admin` via the user menu (top-right avatar dropdown → **Admin Panel**).

### 1.2 First-Time Setup

After a fresh install, complete these steps in order:

1. **Configure SMTP** — email notifications and password resets (see §6).
2. **Configure SSO** — enable LDAP or SAML if needed (see §5).
3. **Create departments** — organise your users (see §3).
4. **Invite users** — send invitations or create accounts (see §2).
5. **Configure storage** — set up S3-compatible storage for attachments (see §7).

---

## 2. User Management

### 2.1 User List

Navigate to **Admin → Users**. The table shows:

- Name, email, department, role, status (active / suspended / invited), last login.
- Search and filter by name, email, department, or role.
- Click a user row to view their profile and edit details.

### 2.2 Inviting Users

1. Click **Invite User**.
2. Enter the user's email and select their role.
3. Click **Send Invitation**. The user receives an email with a magic link to set their password.

### 2.3 Creating Users Manually

1. Click **Create User**.
2. Fill in: name, email, password (must be ≥ 8 chars), department, role.
3. Click **Save**. The user can log in immediately.

### 2.4 Editing Users

- Change name, email, department, preferred locale, accent color, theme.
- All changes are audited.

### 2.5 Suspending Users

1. Click **Suspend** on the user's profile.
2. The user's session is revoked immediately; they cannot log in until restored.
3. Suspended users retain their data and assignments.

### 2.6 Changing Roles

1. Click the role dropdown on the user's profile.
2. Select the new role. Permission changes take effect immediately.

### 2.7 Force Logout

1. Click **Force Logout** to revoke all active sessions for a user.
2. Useful when a user's device is lost or compromised.

### 2.8 Deleting Users

- Soft-delete: user is marked as deleted, their data preserved.
- Tasks assigned to a deleted user become unassigned.

---

## 3. Department Management

### 3.1 Creating Departments

1. Navigate to **Admin → Departments**.
2. Click **New Department**.
3. Enter a name and optional parent department (for tree structure).
4. Click **Save**.

### 3.2 Editing Departments

- Rename, change parent, or move users between departments.

### 3.3 Deleting Departments

- Soft-delete: the department is archived, users are unlinked.
- Cannot delete a department with active projects — reassign projects first.

---

## 4. Role-Based Access Control

### 4.1 Built-in Roles

| Role | Description |
|------|-------------|
| **Owner** | Full access to everything. Can delete the org. |
| **Admin** | Full administrative access. Cannot delete the org. |
| **Manager** | Can manage projects, tasks, and team members. |
| **Member** | Standard user. Can create and work on tasks. |
| **Guest** | Read-only access to assigned projects. |

### 4.2 Permission Matrix

| Permission | Owner | Admin | Manager | Member | Guest |
|------------|-------|-------|---------|--------|-------|
| `task:create` | ✓ | ✓ | ✓ | ✓ | — |
| `task:edit_any` | ✓ | ✓ | ✓ | — | — |
| `task:delete_any` | ✓ | ✓ | ✓ | — | — |
| `project:create` | ✓ | ✓ | ✓ | — | — |
| `project:edit_any` | ✓ | ✓ | ✓ | — | — |
| `project:delete_any` | ✓ | ✓ | — | — | — |
| `custom_field:define` | ✓ | ✓ | ✓ | — | — |
| `project_role:assign` | ✓ | ✓ | ✓ | — | — |
| `user:invite` | ✓ | ✓ | ✓ | — | — |
| `user:suspend` | ✓ | ✓ | — | — | — |
| `settings:update` | ✓ | ✓ | — | — | — |
| `org:reports` | ✓ | ✓ | ✓ | ✓ | — |
| `audit:view` | ✓ | ✓ | ✓ | — | — |

### 4.3 How Permissions Are Enforced

- Every API endpoint checks `can(user, action, resource)`.
- The UI conditionally hides actions the user cannot perform.
- Public API token permissions are additive to the user's RBAC role.

---

## 5. SSO Configuration

### 5.1 Local Authentication (Default)

- Users register and log in with email + password.
- Password reset via magic link (requires SMTP configuration).

### 5.2 LDAP / Active Directory

1. Navigate to **Admin → SSO → LDAP**.
2. Fill in:
   - **Server URL**: `ldap://ldap.example.com:389` or `ldaps://...`
   - **Bind UPN**: service-account UPN, e.g. `svc-taskapp@corp.example.com`
   - **Bind Password**: password for the bind account
   - **UPN Suffix**: optional (e.g. `@corp.example.com`) — appended when users log in with a bare `sAMAccountName`
   - **Email / Name attribute**: which directory attributes map to `mail` / `cn` (default `mail` / `cn`)
   - **Default Role**: role assigned to synced users (e.g. `member`)
   - **Sync Interval (hours)**: how often the worker re-syncs groups
3. Click **Test Connection** to verify the bind/search.
4. Under **Group Sync**, search for AD/LDAP groups (by name), add the ones whose members should be provisioned, then click **Sync now** (or wait for the schedule).
5. Toggle **Enable LDAP** to activate.

Users log in with their **full UPN** or a bare `sAMAccountName` (the suffix is appended). Accounts are created on first login (JIT provisioning) and tagged with their group. Users who leave all synced groups are set to `ldapGroupRemoved` (cannot log in, but their data is preserved). See `AUTH.md §4` for the full model.

### 5.3 SAML 2.0

1. Navigate to **Admin → SSO → SAML**.
2. Upload the **IdP Metadata XML** (download from your IdP — Azure AD, Okta, AD FS, Keycloak).
3. Configure:
   - **Entity ID / Issuer**: the SP entity ID (defaults to your `NEXTAUTH_URL`).
   - **ACS URL**: `https://your-instance/api/auth/saml/callback`
   - **Name ID format**: usually `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`.
4. Copy the SP metadata from the admin panel and register it in your IdP.
5. Toggle **Enable SAML** to activate.

---

## 6. SMTP / Email Configuration

### 6.1 SMTP Settings

Navigate to **Admin → Settings → Email**:

| Field | Description |
|-------|-------------|
| Host | SMTP server hostname |
| Port | 587 (STARTTLS) or 465 (TLS) |
| Username | SMTP authentication user |
| Password | SMTP authentication password |
| From Address | `noreply@your-domain.com` |
| Encryption | None / STARTTLS / TLS |
| Allow Self-Signed Certs | For internal SMTP servers |

### 6.2 Test Email

Click **Send Test Email** to verify the configuration. A test message is sent to your email address.

### 6.3 Notifications

The platform sends **in-app notifications** for:

- Task assignment
- @mentions in comments
- New comments on watched tasks
- Status changes
- Due-soon reminders (generated by the worker scheduler)

> **Email delivery and the daily digest are not yet implemented (V1.1 backlog).** SMTP configuration exists for password-reset magic links, but notification emails are not sent in V1.0.

---

## 7. Storage Configuration

### 7.1 Default (Local Filesystem)

Small deployments can use the local filesystem. Files are stored in the container's `/data/uploads` directory.

### 7.2 S3-Compatible Storage

Configure in **Admin → Settings → Storage**:

| Field | Description |
|-------|-------------|
| Endpoint | S3 endpoint URL (e.g. `https://minio.example.com`) |
| Region | AWS region or `us-east-1` for MinIO |
| Access Key | S3 access key ID |
| Secret Key | S3 secret access key |
| Bucket | Bucket name (auto-created) |
| Use Path-Style | Enable for MinIO (disable for AWS S3) |

---

## 8. API Token Management

### 8.1 Viewing Tokens

Each user can manage their own tokens at **Settings → API Tokens**. Admins can view all tokens at **Admin → Tokens**.

### 8.2 Creating a Token

1. Click **New Token**.
2. Enter a name (e.g. "CI Pipeline").
3. Select the required scopes (see the [API Integration Guide](./api-integration.md#2-authentication) for scope reference).
4. Click **Create**. The raw token is shown **once** — copy and store it securely.

### 8.3 Revoking a Token

Click **Revoke**. The token is immediately invalid. Revoked tokens remain in the audit log.

---

## 9. Webhook Management

### 9.1 Creating a Webhook

1. Navigate to **Admin → Webhooks**.
2. Click **New Webhook**.
3. Fill in:
   - **Name**: a label for identification.
   - **URL**: must be HTTPS (SSRF protection enforced — see §9.5).
   - **Events**: select one or more event types.
   - **Secret**: auto-generated; shown once on creation.
4. Click **Create**.

### 9.2 Subscribed Events

| Event | Trigger |
|-------|---------|
| `task.created` | A new task is created |
| `task.updated` | A task is updated |
| `task.deleted` | A task is soft-deleted |
| `task.assigned` | A task is assigned to a user |
| `task.status_changed` | A task's status changes |
| `comment.created` | A comment is added to a task |
| `project.created` | A new project is created |
| `project.updated` | A project is updated |
| `custom_field.updated` | A custom field schema is modified |

### 9.3 Testing a Webhook

1. Click **Test** on the webhook detail page.
2. A synthetic `webhook.test` event is sent to the URL.
3. The delivery appears in the delivery log with status and response.

### 9.4 Delivery Log

Each delivery attempt records:

- Event type and ID
- HTTP status code and response body (truncated to 10k chars)
- Duration
- Error message (if any)
- Attempt number (for retries)

### 9.5 SSRF Protection

Webhook URLs are validated against private/internal network ranges:

| Range | Reason |
|-------|--------|
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | RFC 1918 private |
| `127.0.0.0/8` | Loopback |
| `169.254.0.0/16` | Link-local |
| `::1/128` | IPv6 loopback |
| `fc00::/7` | IPv6 ULA |
| `localhost`, `*.local`, `*.internal` | Hostname blocklist |

URLs must use HTTPS. If your webhook receiver runs on a private network, you can disable SSRF validation per-webhook in the settings.

### 9.6 Retry & Dead-Letter

- Transient failures retry up to 5 times with exponential backoff (5s → 10s → 20s → 40s → 80s).
- After 5 failed attempts, the delivery is moved to the **dead-letter** queue.
- You can **replay** a dead-lettered delivery from the webhook detail page.

---

## 10. Audit Log

### 10.1 Viewing the Audit Log

Navigate to **Admin → Audit Log**. The log shows:

- Timestamp
- Actor (user who performed the action)
- Action type (created, updated, deleted, etc.)
- Target entity type and ID
- Before/after JSON (for updates)
- IP address

### 10.2 Filtering

Filter by:

- Date range
- Action type
- Actor
- Entity type (task, project, user, etc.)

### 10.3 Retention

Audit logs are partitioned monthly. Retention is configurable in **Admin → Settings** (default: 12 months). Old partitions are automatically dropped.

### 10.4 What Is Audited

Every mutation of: tasks, projects, custom fields, comments, users, roles, departments, API tokens, webhooks, settings. Login/logout/session revocations are also audited.

---

## 11. Settings

### 11.1 Organization Settings

Navigate to **Admin → Settings → Organization**:

| Setting | Description |
|---------|-------------|
| Site Name | Displayed in the browser tab title and email footers |
| Default Locale | `fa-IR` (Persian) or `en-US` (English) |
| Default Accent | Accent color for new users |
| Default Theme | Light / Dark / System |
| Session Timeout | Idle session timeout in minutes |

### 11.2 User Preferences

Each user can configure their own preferences at **Settings → Preferences**:

- Locale, accent color, theme, sidebar density.
- Email digest frequency (none, daily, weekly).
- Notification preferences per event type.

---

## 12. Backup & Restore

See the [Installation Guide](../INSTALL.md#5-backup--restore) for full backup/restore procedures.

### 12.1 Automatic Backups

Configure in `.env.prod`:

```
BACKUP_DEST=s3://my-bucket/taskapp-backups
BACKUP_SCHEDULE="0 2 * * *"   # daily at 2 AM
```

A Kubernetes CronJob runs the backup script on schedule.

### 12.2 Manual Backup

```bash
./scripts/backup.sh
```

### 12.3 Restore

```bash
./scripts/restore.sh /path/to/dump.sql.gz
```

---

## 13. Monitoring

### 13.1 Health Endpoint

```
GET /health
```

Returns `200 OK` if the application is running and connected to the database.

### 13.2 Metrics

Prometheus metrics at `/metrics`. Includes:

- HTTP request count, duration, error rate (by route, method, status).
- Database connection pool size and wait time.
- BullMQ queue depth and job durations.
- Webhook delivery count and success/failure rate.

### 13.3 Pre-built Dashboards

See the [Installation Guide](../INSTALL.md#7-monitoring) for Grafana dashboard setup. Four dashboards are available in `ops/grafana/`:

- **API Dashboard**: request rates, latencies, error rates by endpoint.
- **Database Dashboard**: connection pool, query timing, replication lag.
- **Queue Dashboard**: BullMQ job counts, processing times, failure rates.
- **Webhook Dashboard**: delivery volume, success/failure rate, latency.

### 13.4 Alerts

Pre-configured alert rules in `ops/prometheus/`:

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | >5% 5xx errors over 5 min | critical |
| SlowAPI | p95 >500 ms over 5 min | warning |
| QueueBacklog | >1000 jobs waiting for >10 min | warning |
| DiskFull | disk usage >85% | warning |
| BackupFailed | last backup >27 h ago | critical |

---

## 14. Troubleshooting

See the [Installation Guide > Troubleshooting](../INSTALL.md#9-troubleshooting) for common issues.
