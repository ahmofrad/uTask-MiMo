# User Guide

> For day-to-day users of the TaskApp platform.

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Tasks](#3-tasks)
4. [Projects](#4-projects)
5. [Custom Fields](#5-custom-fields)
6. [Comments & Mentions](#6-comments--mentions)
7. [Notifications](#7-notifications)
8. [Search](#8-search)
9. [Quick Add](#9-quick-add)
10. [Profile & Preferences](#10-profile--preferences)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Baselines & EVM](#12-baselines--evm)
13. [Risk Register](#13-risk-register)
14. [Change Requests](#14-change-requests)
15. [Automation Rules](#15-automation-rules)
16. [RTL & Locale Tips](#16-rtl--locale-tips)

---

## 1. Getting Started

### 1.1 Logging In

1. Open your organization's TaskApp URL in your browser.
2. Enter your **email** and **password**.
   - If your organization uses **LDAP** or **SAML SSO**, select the appropriate provider.
3. Click **Log In**.

If you don't have an account yet, ask your administrator to send you an invitation.

### 1.2 First Login

After first login:

1. Complete your profile (name, avatar, locale preference).
2. Choose your preferred **theme** (light / dark / system) and **accent color**.
3. Set your **email digest frequency** if desired.

### 1.3 Language

The app supports **Persian (fa-IR)** and **English (en-US)**. Switch between them using the language selector in the header. Your preference is saved per user.

- Persian: RTL layout, Jalali calendar dates.
- English: LTR layout, Gregorian calendar dates.

---

## 2. Dashboard

### 2.1 My Dashboard

The dashboard shows an overview of your work:

- **Today's tasks** — tasks due today.
- **Upcoming** — tasks due in the next 7 days.
- **Overdue** — tasks past their due date.
- **Recent activity** — recent comments and changes across your projects.

### 2.2 Project Dashboard

Each project has its own dashboard with:

- Status breakdown (open, in progress, done, cancelled).
- Assignee load distribution.
- Custom field value breakdowns.

---

## 3. Tasks

### 3.1 Creating a Task

1. Click the **+ New Task** button or use the **Quick Add** palette (see §9).
2. Fill in:
   - **Title** (required)
   - **Description** (optional, supports Markdown)
   - **Project** (select from available projects)
   - **Assignee** (optional — search by name)
   - **Due Date** (optional — locale-aware date picker)
   - **Priority** — None, Low, Medium, High, Urgent
   - **Tags** (optional — type to search or create)
3. Click **Create**.

### 3.2 Editing a Task

Click on a task to open the **Task Detail** view. You can edit any field inline:

- Title and description (Markdown with live preview).
- Status: Open, In Progress, Done, Cancelled.
- Priority, assignee, due date, tags.
- Custom field values (see §5).

### 3.3 Task Statuses

| Status | Meaning |
|--------|---------|
| Open | Task is created but not started |
| In Progress | Someone is actively working on it |
| Done | Work is complete |
| Cancelled | Task is abandoned |

### 3.4 Subtasks

- Tasks can have subtasks (max 2 levels deep).
- Check off subtasks from the task detail view.
- Subtask progress shows as a completion bar on the parent task.

### 3.5 Reordering Tasks

Drag and drop to reorder tasks within a list. Reordering uses fractional indexing — the order persists across all views and devices.

### 3.6 Soft Delete

Click **Delete** on a task. A 5-second undo toast appears at the bottom of the screen:

- Click **Undo** to restore the task.
- After 5 seconds, the task is soft-deleted (hidden from normal views, preserved in the database).
- Admins can view and restore deleted tasks.

### 3.7 Bulk Actions

Select multiple tasks using the checkbox column:

- **Complete** — set status to Done.
- **Cancel** — set status to Cancelled.
- **Delete** — soft-delete all selected.
- Each action has an undo toast.

### 3.8 Optimistic UI

When you toggle task completion or reorder, the UI updates instantly. If the server request fails, the change is rolled back automatically.

---

## 4. Projects

### 4.1 Viewing Projects

Navigate to **Projects** in the sidebar. Each project card shows:

- Name, description, member avatars.
- Task counts by status.
- Due date (if set).

### 4.2 Creating a Project

1. Click **New Project**.
2. Fill in: name, description, visibility (public / private).
3. Add members (select users by name).
4. Click **Create**.

### 4.3 Project Visibility

- **Public**: visible to all organization members.
- **Private**: visible only to assigned members and admins.

---

## 5. Custom Fields

### 5.1 What Are Custom Fields?

Admins define custom fields per project. Each field has a type and optional validation rules. They appear as additional input fields on the task detail page.

### 5.2 Field Types

| Type | Input | Validation |
|------|-------|------------|
| Text | Single-line input | Max length, regex |
| Number | Numeric input | Min, max |
| Date | Calendar picker | Not in past (optional) |
| Select | Dropdown | Value from predefined list |
| Multi-Select | Tag picker | Values from predefined list |
| User | User picker | Active users only |
| Checkbox | Toggle | — |
| URL | URL input | Valid URL format |

### 5.3 Setting Values

1. Open a task in the project.
2. Scroll to the **Custom Fields** section on the detail page.
3. Fill in values per field. Changes save automatically on blur.

### 5.4 Filtering by Custom Fields

On the task list view, use the **Filter** button to add custom field filters. The filter UI shows the correct input type for each field (e.g., a date picker for date fields).

---

## 6. Comments & Mentions

### 6.1 Adding a Comment

1. Open a task.
2. Scroll to the **Comments** section.
3. Type your comment in the editor (supports **Markdown**).
4. Click **Post**. Comments are threaded (up to 3 levels deep).

### 6.2 @Mentions

Type `@` followed by a name to mention someone:

- A dropdown appears with matching users (by display name or email).
- Select a user to insert their mention.
- The mentioned user receives an in-app notification and (optionally) an email.

### 6.3 Markdown Support

Comments support basic Markdown:

```markdown
**bold** *italic* `code`
- bullet list
1. numbered list
> blockquote
[link text](url)
```

Raw HTML and scripts are stripped for security.

### 6.4 Editing & Deleting

- **Edit**: click the pencil icon on your comment to edit (5-minute window).
- **Delete**: click the trash icon to soft-delete your comment.

---

## 7. Notifications

### 7.1 In-App Notifications

The bell icon in the header shows your unread notification count. Click it to open the dropdown:

- **Notifications are grouped** by event (assigned, mentioned, commented, due soon, status changed).
- Click a notification to open the related task.
- Click **Mark All Read** to clear.

### 7.2 Notification Triggers

| Event | You Receive Notification When |
|-------|-------------------------------|
| Assigned | A task is assigned to you |
| Mentioned | Someone @mentions you in a comment or description |
| Commented | Someone comments on a task you're watching |
| Status Changed | A task you're watching changes status |
| Due Soon | A task you're assigned to is due within 24 hours |

### 7.3 Watchers

You are automatically added as a watcher when:

- You are assigned to a task.
- You are mentioned in a comment.
- You comment on a task.

You can manually watch/unwatch any task from the task detail page.

### 7.4 Notifications

You receive **in-app notifications** (bell icon, top-right) for:

- New assignments.
- @mentions.
- New comments on tasks you watch.
- Status changes.
- Due-soon reminders.

> **Email and daily-digest notifications are not yet available (V1.1 backlog).** Clicking an in-app notification opens the related task.

---

## 8. Search

### 8.1 Basic Search

Press `/` to focus the search bar, or click the search icon in the header. Results include:

- Tasks (title and description).
- Comments.
- Projects.
- Custom field values (text fields).

### 8.2 Search Filters

Refine your search with:

- `type:task` — tasks only.
- `type:project` — projects only.
- `type:comment` — comments only.
- `project:<name>` — within a specific project.
- `status:open`, `status:done` — by status.
- `assignee:<name>` — by assignee.

### 8.3 Recent Searches

Your recent searches are saved per user. Click on a recent search to re-run it.

---

## 9. Quick Add

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open the **Quick Add** palette.

1. Type a task title.
2. Optionally set project, assignee, due date, priority.
3. Press **Enter** to create. The task appears in the project instantly.

Advanced quick add syntax:

```
Design landing page @alice #marketing !high p:Website due:tomorrow
```

- `@alice` — assign to Alice.
- `#marketing` — add to the "marketing" project.
- `!high` — set priority to High.
- `p:Website` — project by name (if `#` doesn't match).
- `due:tomorrow` — set due date.

---

## 10. Profile & Preferences

### 10.1 Profile Settings

Click your avatar → **Settings** → **Profile**:

- Change your name, email, avatar.
- Change your password.

### 10.2 Preferences

- **Locale**: `fa-IR` (Persian) or `en-US` (English).
- **Accent Color**: 8 presets + custom hex picker.
- **Theme**: Light, Dark, or System (follows OS preference).
- **Density**: Comfortable or Compact sidebar.
- **Email Digest**: None, Daily, or Weekly.

### 10.3 API Tokens

Manage your personal API tokens at **Settings → API Tokens**:

- Create tokens with specific scopes.
- View token prefix and creation date.
- Revoke tokens individually.

See the [API Integration Guide](./api-integration.md) for usage.

---

## 11. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick Add palette |
| `/` | Focus search |
| `Escape` | Close modal / palette |
| `?` | Show keyboard shortcuts help |

---

## 12. Baselines & EVM

### 12.1 Capturing a Baseline

Project Managers can capture a snapshot of the current schedule and progress:

1. Navigate to your project → **Baselines**.
2. Click **Capture Baseline**.
3. Enter a name (e.g. "Sprint 5 baseline").
4. Click **Save**.

A baseline freezes the current plan (task start/end dates, progress) so you can compare planned vs. actual over time.

### 12.2 EVM Metrics

The EVM dashboard shows earned value metrics:

- **PV** (Planned Value): what should have been done by now.
- **EV** (Earned Value): what was actually completed.
- **AC** (Actual Cost): what was spent.
- **CPI** (Cost Performance Index): EV/AC. Above 1 = under budget.
- **SPI** (Schedule Performance Index): EV/PV. Above 1 = ahead of schedule.

### 12.3 Variance Report

The variance report compares planned vs. actual for each task, highlighting schedule and cost deltas.

---

## 13. Risk Register

### 13.1 Viewing Risks

Navigate to your project → **Risks** to see the risk register:

- Each risk has a reference (RISK-NNN), title, probability, impact, and a score (probability × impact).
- Risks are color-coded by score: low (green), medium (yellow), high (orange), critical (red).

### 13.2 Creating a Risk

1. Click **Add Risk**.
2. Fill in: title, description, probability (1–5), impact (1–5), response plan, owner.
3. Click **Save**.

### 13.3 Response Plans

| Response | Meaning |
|----------|---------|
| Mitigate | Reduce probability or impact |
| Accept | Acknowledge the risk, no action |
| Transfer | Shift responsibility (e.g., insurance) |
| Avoid | Eliminate the risk entirely |

---

## 14. Change Requests

### 14.1 Creating a Change Request

Navigate to your project → **Change Requests**:

1. Click **New Change Request**.
2. Fill in: title, description, schedule delta (days), cost impact.
3. Click **Create**. Status starts as DRAFT.

### 14.2 Submitting for Approval

Click **Submit** to send the CR for review. A decision-maker can then **Approve** or **Reject** it.

### 14.3 Applying a Change Request

Click **Apply** on an approved CR. This automatically captures a baseline snapshot so you can track the change's impact over time.

---

## 15. Automation Rules

### 15.1 How Automation Works

Automation rules let you define triggers, conditions, and actions that run automatically when events occur.

**Example:** When a task's status changes to "Done" → if the task has a custom field "QA Required" set to true → automatically create a follow-up QA task.

### 15.2 Creating a Rule

Navigate to **Admin → Automation Rules**:

1. Click **New Rule**.
2. Define:
   - **Trigger**: the event that starts the rule (e.g., task status changed).
   - **Conditions**: conditions that must be true (e.g., field X equals Y).
   - **Actions**: what to do (e.g., assign a user, add a label, set a custom field).
3. Click **Create**.

### 15.3 Execution Log

Each rule execution is logged. Check the **Runs** tab on a rule to see its execution history, including any errors.

---

## 16. RTL & Locale Tips

- In **Persian (fa-IR)** mode, the layout mirrors to RTL: sidebar on the right, content on the left.
- Logical CSS properties ensure icons and spacing flip correctly.
- The **Jalali calendar** is used for date pickers, due dates, and relative dates.
- Numbers in Persian mode can optionally use Persian numerals (configure in preferences).
