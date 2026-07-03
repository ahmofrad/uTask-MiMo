WIREFRAMES.md — Screen-by-Screen Implementation Guide
Detailed wireframes for every screen in the platform. Each screen lists its route, file path, layout, components, interactions, states, data, RBAC, and i18n keys.
Read this alongside DESIGN.md (visual language) and SPEC.md (product behavior).

Conventions
File path conventions
text

Copy
src/app/[locale]/

  (auth)/

    login/page.tsx

    login/sso/page.tsx

    invite/[token]/page.tsx

    forgot-password/page.tsx

    reset-password/[token]/page.tsx

  (app)/

    layout.tsx                  ← the AppShell (sidebar + header + content)

    inbox/page.tsx

    today/page.tsx

    upcoming/page.tsx

    all/page.tsx

    my-tasks/page.tsx

    projects/page.tsx

    projects/[projectId]/page.tsx

    projects/[projectId]/board/page.tsx

    projects/[projectId]/dashboard/page.tsx

    projects/[projectId]/members/page.tsx

    projects/[projectId]/custom-fields/page.tsx

    projects/[projectId]/settings/page.tsx

    tasks/[taskId]/page.tsx       ← full-page detail (deep link)

    search/page.tsx

    notifications/page.tsx

    dashboard/page.tsx

    settings/

      layout.tsx                 ← settings sidebar

      page.tsx                   ← redirects to /settings/profile

      profile/page.tsx

      appearance/page.tsx

      language/page.tsx

      notifications/page.tsx

      tokens/page.tsx

      sessions/page.tsx

    admin/

      layout.tsx                 ← admin sidebar + permission gate

      page.tsx                   ← admin overview

      users/page.tsx

      users/[userId]/page.tsx

      departments/page.tsx

      ldap/page.tsx

      saml/page.tsx

      smtp/page.tsx

      storage/page.tsx

      tokens/page.tsx

      webhooks/page.tsx

      webhooks/[webhookId]/page.tsx

      webhook-deliveries/page.tsx

      audit/page.tsx

      backups/page.tsx

      settings/page.tsx

  not-found.tsx

  error.tsx

  loading.tsx

  global-error.tsx


src/components/

  shell/AppShell.tsx

  shell/Sidebar.tsx

  shell/Header.tsx

  shell/CommandPalette.tsx

  shell/QuickAdd.tsx

  shell/NotificationBell.tsx

  shell/UserMenu.tsx

  shell/LocaleSwitcher.tsx


  task/TaskRow.tsx

  task/TaskList.tsx

  task/TaskDetail.tsx

  task/TaskQuickAdd.tsx

  task/TaskForm.tsx

  task/TaskFilters.tsx

  task/CommentThread.tsx

  task/CommentInput.tsx

  task/MentionInput.tsx

  task/AttachmentList.tsx

  task/ActivityTimeline.tsx

  task/SubtaskList.tsx


  custom-field/CustomFieldRenderer.tsx

  custom-field/CustomFieldSchemaEditor.tsx

  custom-field/CustomFieldFilter.tsx


  admin/UserTable.tsx

  admin/DepartmentTree.tsx

  admin/LdapConfigForm.tsx

  admin/SamlConfigForm.tsx

  admin/SmtpConfigForm.tsx

  admin/StorageConfigForm.tsx

  admin/ApiTokenTable.tsx

  admin/WebhookForm.tsx

  admin/WebhookDeliveryList.tsx

  admin/AuditLogTable.tsx

  admin/BackupPanel.tsx


  dashboard/MyDashboard.tsx

  dashboard/ProjectDashboard.tsx

  dashboard/OrgDashboard.tsx

  dashboard/KpiCard.tsx

  dashboard/StatusBreakdownChart.tsx

  dashboard/BurndownChart.tsx


  feedback/EmptyState.tsx

  feedback/ErrorState.tsx

  feedback/LoadingSkeleton.tsx

  feedback/ConfirmDialog.tsx

  feedback/UndoToast.tsx
ASCII legend
text

Copy
[ Button ]            Primary button

( Button )            Secondary / ghost button

{ Input }             Text input

▾                     Dropdown

▣                     Checkbox

◉                     Radio

📎                    Icon (Lucide name in brackets [Paperclip])

─────                 Divider

··                    Truncation / overflow

xxx                   Dynamic / placeholder text
State markers (used in descriptions)

default — primary rendering

empty — no data

loading — skeleton

error — recoverable error

denied — RBAC blocks

offline — network failure (V1.1)

0. The AppShell
Route: src/app/[locale]/(app)/layout.tsx
File: src/components/shell/AppShell.tsx + Sidebar.tsx + Header.tsx

The (app) layout wraps every authenticated route. All routes inside (app)/ render inside this shell.

Layout (desktop, LTR; mirrors for RTL)
text

Copy
┌──────────────────────────────────────────────────────────────┐

│ Header 56px                                                  │

│ ┌─────┐  [ ⌘K Search ]                    🔔  🌐  👤 avatar  │

│ │Logo │                                                  ▾   │

│ └─────┘                                                       │

├──────────┬───────────────────────────────────────────────────┤

│ Sidebar  │ Content (max-w-1280 mx-auto px-6 py-8)            │

│ 240px    │                                                   │

│          │   {route content}                                 │

│ Inbox 3  │                                                   │

│ Today 5  │                                                   │

│ Upcom. 2 │                                                   │

│ ─────    │                                                   │

│ Projects │                                                   │

│  • Work  │                                                   │

│  • Per.  │                                                   │

│  • Team  │                                                   │

│ ─────    │                                                   │

│ + New    │                                                   │

│ ─────    │                                                   │

│ Admin ⚙  │  (only if owner/admin)                            │

└──────────┴───────────────────────────────────────────────────┘
Header (Header.tsx)
text

Copy
┌──────────────────────────────────────────────────────────────────┐

│ Logo │  [⌘K Search tasks, projects, people...]  │ 🔔3 │ 🌐 │ 👤▾ │

└──────────────────────────────────────────────────────────────────┘

Logo: wordmark, links to /dashboard.

Global search input: placeholder from search.placeholder. Clicking focuses /search. Cmd/Ctrl+K opens the <CommandPalette> modal.

NotificationBell: <NotificationBell />, badge with unread count. Click opens dropdown (last 10 notifications + "See all" link to /notifications).

LocaleSwitcher: dropdown with fa-IR / en-US. Selection updates cookie + reloads.

UserMenu: avatar + displayName, dropdown: Profile, Settings, Theme (light/dark/system), Sign out.

Sidebar (Sidebar.tsx)
Sections (top → bottom):

1.
Inbox — count badge for unassigned + watching.
2.
Today — count for due today.
3.
Upcoming — count for next 7 days.
4.
My Tasks — count assigned to me.
5.
All Tasks — full list.
6.
Projects (collapsible group):

"+ New project" button at top.

Each project: color dot + name. Hover shows actions menu (open, archive, settings).

Active project bolded.

Pinned projects (V1.1) at top.

7.
Admin (Owner/Admin only) — link to /admin.
8.
Footer: collapse sidebar button (toggle 240px ↔ 64px), collapsed shows icons + tooltips.
Behavior:


Active route highlighted with bg-accent-bg + accent left border.

Collapsed state persisted per user in User.preferences.sidebarCollapsed.

On mobile (< 768px): sidebar hidden, replaced with bottom tab bar (Inbox, Today, Upcoming, Search, More).

Keyboard nav: ↑/↓ moves focus within section, Enter activates, 1–4 jumps to top-level items.

Command Palette (CommandPalette.tsx)
Triggered by Cmd/Ctrl+K from anywhere.

text

Copy
┌─────────────────────────────────────────────────────────┐

│  [ ⌘K ]  Type a command or search...                    │

├─────────────────────────────────────────────────────────┤

│  Tasks                                                  │

│   → Create new task                              ⏎     │

│   → Go to Inbox                                G I    │

│   → Go to Today                                G T    │

│   → Go to Upcoming                             G U    │

│                                                         │

│  Recent                                                 │

│   → Fix login bug            In Progress · Work proj   │

│   → Write API docs           Today · Engineering       │

│                                                         │

│  Settings                                               │

│   → Switch theme             Light / Dark / System    │

│   → Manage API tokens                                 │

│                                                         │

│  Jump to                                                │

│   → Inbox                                          G I │

│   → Today                                          G T │

│   → Project: Work                                         │

│   → User: Sara M.                                         │

└─────────────────────────────────────────────────────────┘

Up/Down to navigate, Enter to activate, Esc to close.

Fuzzy search across commands, recent tasks, projects, users.

Empty state: "Start typing to search tasks, projects, or people."

1. Auth Screens
1.1 Login — Local
Route: /[locale]/login
File: src/app/[locale]/(auth)/login/page.tsx
RBAC: unauthenticated only (redirect to /dashboard if already signed in)

text

Copy
┌────────────────────────────────────────────┐

│                                            │

│                                            │

│              [TaskApp Logo]                │

│                                            │

│              Sign in                       │

│       Welcome back. Sign in to continue.   │

│                                            │

│       { Email          }                   │

│       { Password       } 👁                │

│                                            │

│       [ Forgot password? ]                 │

│                                            │

│       [    Sign in     ]                   │

│                                            │

│       ───────  or  ───────                 │

│                                            │

│       ( Sign in with SSO  )                │

│                                            │

│                                            │

│       Don't have an account?               │

│       Ask your admin to invite you.        │

│                                            │

└────────────────────────────────────────────┘

Email + password → POST /api/v1/auth/login.

On 200 → redirect to ?next= param or /dashboard.

On 401 → inline error below password field. Do NOT reveal whether email exists (generic "Invalid email or password").

On 429 → "Too many attempts. Try again in X minutes."

"Sign in with SSO" → /login/sso.

"Forgot password" → /forgot-password.

Auth shell layout (centered card, no sidebar).

If local auth is disabled in install settings, hide the form and show only SSO button.

1.2 Login — SSO
Route: /[locale]/login/sso
File: src/app/[locale]/(auth)/login/sso/page.tsx

text

Copy
┌────────────────────────────────────────────┐

│              Sign in with SSO              │

│                                            │

│  Choose your identity provider:            │

│                                            │

│  ┌──────────────────────────────────────┐  │

│  │ 🏢  Acme Corp AD                    │  │

│  │      LDAP / Active Directory        │  │

│  └──────────────────────────────────────┘  │

│  ┌──────────────────────────────────────┐  │

│  │ 🔐  Acme Okta                       │  │

│  │      SAML 2.0                       │  │

│  └──────────────────────────────────────┘  │

│                                            │

│  ← Back to local login                     │

└────────────────────────────────────────────┘

Lists enabled providers from GET /api/v1/auth/providers.

Click → redirect to provider's auth start endpoint.

If only one provider, skip this screen and redirect directly.

1.3 Forgot Password
Route: /[locale]/forgot-password
File: src/app/[locale]/(auth)/forgot-password/page.tsx

text

Copy
┌────────────────────────────────────────────┐

│              Reset password                 │

│                                            │

│  Enter your email and we'll send you a     │

│  link to reset your password.              │

│                                            │

│       { Email                       }      │

│                                            │

│       [    Send reset link    ]            │

│                                            │

│       ← Back to sign in                    │

└────────────────────────────────────────────┘

Always returns generic "If the email exists, we sent a reset link" — never reveal whether email exists.

Rate-limited to 3 requests/hour/email.

1.4 Reset Password
Route: /[locale]/reset-password/[token]
File: src/app/[locale]/(auth)/reset-password/[token]/page.tsx

text

Copy
┌────────────────────────────────────────────┐

│              Set a new password             │

│                                            │

│       { New password           } 👁        │

│       { Confirm new password  } 👁         │

│                                            │

│  Password requirements:                    │

│  ✓ At least 12 characters                  │

│  ✓ One uppercase letter                    │

│  ✓ One number                              │

│                                            │

│       [    Save password      ]            │

└────────────────────────────────────────────┘

Token from URL; if invalid/expired show error + "Request a new link".

On success → "Password saved" + auto-login.

1.5 Invite Acceptance
Route: /[locale]/invite/[token]
File: src/app/[locale]/(auth)/invite/[token]/page.tsx

text

Copy
┌────────────────────────────────────────────┐

│              You've been invited            │

│                                            │

│  Sara M. invited you to join Acme Corp    │

│  as a Member.                              │

│                                            │

│       { Display name           }           │

│       { Set a password           } 👁       │

│                                            │

│       [    Accept invitation   ]            │

└────────────────────────────────────────────┘

Token validated server-side. Expired/invalid → error.

On accept: user created, password set, role assigned, logged in.

2. Main Views
All main views share the <AppShell> and the main content area. They differ in:


The data query (filter / sort)

The presence of group headers (Upcoming groups by day)

The empty state copy

2.1 Inbox
Route: /[locale]/(app)/inbox
File: src/app/[locale]/(app)/inbox/page.tsx
Title key: views.inbox.title

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Inbox                                          [ Filter ▾ ] [⋯] │

├────────────────────────────────────────────────────────────────┤

│                                                                │

│  ▣  [ ]  Fix login bug                  Work · Due Today   👤 │

│         Mentioned you · 2h ago                                │

│                                                                │

│  ▣  [ ]  Review PR #234                 Work · No date    👤 │

│         Watching · yesterday                                  │

│                                                                │

│  ▣  [✓]  Update sprint board           Engineering · Done 👤 │

│         Auto-archived                                         │

│                                                                │

└────────────────────────────────────────────────────────────────┘

Lists: unassigned in my projects + tasks where I'm a watcher.

Density: respects user preference.

Bulk select: checkbox per row + bulk toolbar (Complete, Delete, Assign, Tag, Move to project, Set due date).

Filter: by project, priority, due-date range.

Sort: by date added (default), due date, priority.

Empty state: illustration + "Your inbox is clear" + "Tasks you're watching or that need you will show up here."

Header action: "Mark all as read" (dismisses notifications).

Cmd/Ctrl+A selects all on page.

2.2 Today
Route: /[locale]/(app)/today
File: src/app/[locale]/(app)/today/page.tsx
Title key: views.today.title

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Today                                       [ Filter ▾ ] [⋯]  │

│ 3 tasks · 2 overdue                                           │

├────────────────────────────────────────────────────────────────┤

│ OVERDUE                                                        │

│ ▣ [ ]  Send weekly report             Work · Due Mon  👤    │

│ ▣ [ ]  Review design v2               Product · Due Tue 👤  │

│                                                                │

│ TODAY                                                          │

│ ▣ [ ]  Reply to Acme email            Work · 4:00 PM     👤  │

│ ▣ [ ]  Update deployment docs         Eng · 5:00 PM      👤  │

│ ▣ [ ]  Review PR #234                 Work · Today       👤  │

│                                                                │

│ NO TIME                                                        │

│ ▣ [ ]  Plan next sprint               Work · No time     👤  │

└────────────────────────────────────────────────────────────────┘

Groups: Overdue · Today · No time.

Quick reschedule: hover a row → "Today / Tomorrow / Next week" inline actions.

Click row → opens task detail (right Sheet on desktop, full page on mobile).

Empty state: "Nothing due today" + "Take a breath — or plan ahead." + link to /upcoming.

2.3 Upcoming
Route: /[locale]/(app)/upcoming
File: src/app/[locale]/(app)/upcoming/page.tsx
Title key: views.upcoming.title

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Upcoming                                     [ Filter ▾ ] [⋯]  │

│ Next 14 days                                                   │

├────────────────────────────────────────────────────────────────┤

│ Today · 3 tasks                                                │

│ ▣ [ ]  Reply to Acme email            Work                  👤 │

│ ▣ [ ]  Update deployment docs         Eng                   👤 │

│ ▣ [ ]  Review PR #234                 Work                  👤 │

│                                                                │

│ Tomorrow · 2 tasks                                             │

│ ▣ [ ]  Prepare sprint demo            Product               👤 │

│ ▣ [ ]  Send invoice #1234             Finance               👤 │

│                                                                │

│ This week · 4 tasks                                            │

│ ▣ [ ]  Q1 retro prep                  Eng                   👤 │

│  …                                                              │

│                                                                │

│ Next week · 3 tasks                                            │

│  …                                                              │

└────────────────────────────────────────────────────────────────┘

Day headers are localized dates (Jalali or Gregorian per user).

"Load more" button at bottom for older weeks (cursor pagination).

2.4 My Tasks
Route: /[locale]/(app)/my-tasks
File: src/app/[locale]/(app)/my-tasks/page.tsx
Title key: views.myTasks.title


Same layout as Inbox but filtered to assigneeId = currentUser.

Grouped by: Active / Due today / Upcoming / No due date / Completed this week.

"Completed this week" group collapsed by default.

2.5 All Tasks
Route: /[locale]/(app)/all
File: src/app/[locale]/(app)/all/page.tsx


All tasks across projects the user can see.

Same row UI; filter bar mandatory at top.

2.6 Projects (grid)
Route: /[locale]/(app)/projects
File: src/app/[locale]/(app)/projects/page.tsx
Title key: views.projects.title

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Projects                                  [ + New Project ]    │

│                                                                │

│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │

│ │ ● Work        │ │ ● Personal    │ │ ● Team        │            │

│ │               │ │               │ │               │            │

│ │ 23 tasks      │ │ 5 tasks       │ │ 12 tasks      │            │

│ │ 8 in progress │ │ 1 in progress │ │ 4 in progress │            │

│ │               │ │               │ │               │            │

│ │ 3 members     │ │ 1 member      │ │ 5 members     │            │

│ └──────────────┘ └──────────────┘ └──────────────┘            │

└────────────────────────────────────────────────────────────────┘

Card grid; each card: color dot, name, task count, in-progress count, members avatars.

Click card → /projects/[id].

"+ New Project" opens <NewProjectDialog>.

Filter: by department, archived (toggle).

Sort: by name, by last activity, by member count.

3. Project Screens
3.1 Project — Default (list)
Route: /[locale]/(app)/projects/[projectId]
File: src/app/[locale]/(app)/projects/[projectId]/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ ● Work                                          [ ⚙ Settings ] │

│   23 tasks · 3 members · Department: Engineering              │

├────────────────────────────────────────────────────────────────┤

│ [List] [Board] [Dashboard]    [ + Add task ]  [ Filter ▾ ] [⋯]│

├────────────────────────────────────────────────────────────────┤

│ ▣ [ ] Fix login bug            [bug] High    👤  Due Tomorrow │

│        Engineering · #login · Story points: 5                │

│ ▣ [✓] Update docs             [docs] Med    👤  Done 2d ago  │

│ ▣ [ ] Review PR #234          [review] Urgent 👤  Due Today  │

│  …                                                              │

│                                                                │

│                          [ Load more ]                        │

└────────────────────────────────────────────────────────────────┘

Tabs: List (default) · Board (lite kanban) · Dashboard.

Header: project name + meta (members, department, custom field count).

"+ Add task" → opens inline <TaskQuickAdd> or full <TaskForm>.

Row UI: checkbox, title, tags, priority badge, assignee, due date.

Custom field values shown as inline chips if user expanded the row (caret toggle).

Filter ▾: status, priority, assignee, tags, custom fields, due range.

⋯ menu: Bulk actions, Sort options, View density, Export (V1.1).

Empty state: illustration + "No tasks here yet" + "+ Add task" button.

Permission: must be project member (or project is dept/org-visible and user is in dept).

3.2 Project — Board (lite kanban)
Route: /[locale]/(app)/projects/[projectId]/board
File: src/app/[locale]/(app)/projects/[projectId]/board/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ ● Work                                          [ ⚙ Settings ] │

├────────────────────────────────────────────────────────────────┤

│ [List] [Board] [Dashboard]                                    │

├──────────────┬──────────────┬──────────────┬──────────────────┤

│ Open    12   │ In Prog. 5   │ Done    6    │ Cancelled 2       │

│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐    │

│ │Fix login │ │ │Update doc│ │ │Fix typo  │ │ │Old idea  │    │

│ │ High 👤  │ │ │ Med  👤  │ │ │ Low  👤  │ │ │ Low      │    │

│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘    │

│ ┌──────────┐ │ ┌──────────┐ │              │                  │

│ │Review PR │ │ │API docs  │ │              │                  │

│ │ Urgent👤 │ │ │ High 👤  │ │              │                  │

│ └──────────┘ │ └──────────┘ │              │                  │

│  …           │  …           │              │                  │

└──────────────┴──────────────┴──────────────┴──────────────────┘

Columns: Open, In Progress, Done, Cancelled.

Drag card between columns → updates task status.

Card shows: title, priority, assignee, due date, custom field badges.

Column header shows count.

No swimlanes, no WIP limits (V1.1).

Mobile: column-by-column horizontal scroll.

3.3 Project — Dashboard
Route: /[locale]/(app)/projects/[projectId]/dashboard
File: src/app/[locale]/(app)/projects/[projectId]/dashboard/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ ● Work — Dashboard                                            │

├────────────────────────────────────────────────────────────────┤

│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │

│ │ 23 Total   │ │ 8 Open     │ │ 5 In Prog. │ │ 10 Done    │   │

│ │ tasks      │ │            │ │            │ │            │   │

│ └────────────┘ └────────────┘ └────────────┘ └────────────┘   │

│                                                                │

│ ┌─────────────────────────┐ ┌────────────────────────────┐    │

│ │ Status breakdown        │ │ Assignee load              │    │

│ │  ▣ Open  8              │ │  👤 Sara      ████ 5       │    │

│ │  ▣ IP    5              │ │  👤 Ali       ███ 4        │    │

│ │  ▣ Done  10             │ │  👤 Reza      ██ 3         │    │

│ │  ▣ Canc  2              │ │  👤 Unassigned █ 3         │    │

│ └─────────────────────────┘ └────────────────────────────┘    │

│                                                                │

│ ┌───────────────────────────────────────────────────────┐    │

│ │ Burndown (last 30 days)                              │    │

│ │    ╲╲                                                 │    │

│ │     ╲╲╲                                               │    │

│ │       ╲╲╲╲___                                         │    │

│ │             ──────────                                │    │

│ └───────────────────────────────────────────────────────┘    │

│                                                                │

│ ┌───────────────────────────────────────────────────────┐    │

│ │ Custom field: Story points distribution              │    │

│ │  1: ███   2: ██████   3: █████████   5: ██████       │    │

│ │  8: ███   13: █                                       │    │

│ └───────────────────────────────────────────────────────┘    │

└────────────────────────────────────────────────────────────────┘

KPI cards: total, open, in-progress, done.

Status breakdown (donut chart).

Assignee load (horizontal bar per user).

Burndown (line chart, last 30 days).

Custom field breakdowns: for each non-text custom field with values, show a chart.

All charts respect RTL + tokens + dark mode.

3.4 Project — Members
Route: /[locale]/(app)/projects/[projectId]/members
File: src/app/[locale]/(app)/projects/[projectId]/members/page.tsx
RBAC: project lead, admin, owner

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Project members                              [ + Add member ] │

├────────────────────────────────────────────────────────────────┤

│  👤 Sara M.       sara@corp.com        Lead       [ ⋯ ]       │

│  👤 Ali R.        ali@corp.com         Contributor[ ⋯ ]       │

│  👤 Reza K.       reza@corp.com        Contributor[ ⋯ ]       │

│  👤 Maryam S.     maryam@corp.com      Viewer     [ ⋯ ]       │

└────────────────────────────────────────────────────────────────┘

"+ Add member" → modal with user picker (search + add).

Per-row actions: change role, remove from project.

Bulk select → bulk role change / remove.

3.5 Project — Custom Fields
Route: /[locale]/(app)/projects/[projectId]/custom-fields
File: src/app/[locale]/(app)/projects/[projectId]/custom-fields/page.tsx
RBAC: project lead, admin, owner

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Custom fields                                  [ + Add field ] │

├────────────────────────────────────────────────────────────────┤

│ ≡  Story points    Number       Required  [ ⋯ ]               │

│    Used on 23 tasks · Avg: 5.2                                │

│                                                                │

│ ≡  Component       Select       Optional  [ ⋯ ]               │

│    Options: Backend, Frontend, Infra   [Manage options]       │

│                                                                │

│ ≡  QA URL          URL          Optional  [ ⋯ ]               │

│                                                                │

│ ≡  Reviewers       User         Optional  [ ⋯ ]               │

└────────────────────────────────────────────────────────────────┘

"+ Add field" → <CustomFieldForm> sheet:
text

Copy
Field name          [                  ]

Key (slug)          [                  ]  (auto-generated, editable)

Type                [ Text ▾ ]  (radio: text, number, date, select, multi_select, user, checkbox, url)

Required            [▣]

Default value       [                  ] (per type)

─── Type-specific config ───

(if select/multi_select:)

  Options           [ Backend ✕ ] [ Frontend ✕ ] [ + Add ]

  Colors            [●] [●] [●]

(if number:)

  Min [  ]  Max [  ]  Step [  ]  Unit [  ]

(if text:)

  Max length [ 255 ]   Regex [              ]

(if date:)

  Include time [▣]

───────────────────────────

[ Cancel ]   [ Save field ]

Drag handle ≡ to reorder; orderIndex persisted.

⋯ menu: Edit, Archive, Delete (if unused).

Archived fields shown in collapsed section "Archived fields (3)" with restore option.

3.6 Project — Settings
Route: /[locale]/(app)/projects/[projectId]/settings
File: src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx
RBAC: project lead, admin, owner

Tabs (sub-nav under project shell):


General: name, description (markdown), color picker, visibility (private/dept/org).

Danger zone: Archive project / Delete project (soft delete, 30-day restore window).

4. Task UI
4.1 Task Quick Add (Cmd+K palette)
Trigger: Cmd/Ctrl+K from anywhere
File: src/components/shell/CommandPalette.tsx (combined) + src/components/task/TaskQuickAdd.tsx

Modal overlay with focused input.

text

Copy
┌────────────────────────────────────────────────────────┐

│   + Create task                                        │

│   ─────────────────                                    │

│   Title        [ Fix the login bug              ]      │

│   Project      [ Work                        ▾ ]      │

│   Assignee     [ 👤 Sara M.                  ▾ ]      │

│   Due date     [ Tomorrow (Mon Dec 2)         📅 ]    │

│   Priority     [ Med                         ▾ ]      │

│                                                        │

│   [x] More options (description, tags, custom fields)  │

│                                                        │

│                          [ Cancel ]  [ Create ]       │

└────────────────────────────────────────────────────────┘

Inline expansion for advanced fields.

"Create" submits; on success, modal closes, toast "Created", new task briefly highlighted in current view.

Cmd/Ctrl+Enter shortcut to submit.

Recent projects pinned at top of project picker.

All other command palette items (navigation, settings) live in the same Cmd+K modal — task creation is the first mode, switchable via "+" prefix.

4.2 Task Row
File: src/components/task/TaskRow.tsx

Used in: Inbox, Today, Upcoming, My Tasks, All, Project list, search results.

text

Copy
Compact (32 px):

┌─────────────────────────────────────────────────────────────┐

│ ▣  Fix login bug   Work · High    👤 Sara   Due Tomorrow    │

└─────────────────────────────────────────────────────────────┘


Comfortable (56 px, default):

┌─────────────────────────────────────────────────────────────┐

│ ▣  [ ]  Fix login bug                  [bug] High          │

│        Engineering · Login flow · Story points: 5          │

│                                          👤 Sara   📅 Tue  │

└─────────────────────────────────────────────────────────────┘


Spacious (88 px, card-like):

┌─────────────────────────────────────────────────────────────┐

│ ▣  [ ]  Fix login bug                  [bug] High          │

│        The login page throws 500 when password contains...  │

│        Engineering · #login · Story points: 5              │

│        👤 Sara   📅 Tue   👁 3 watchers                    │

└─────────────────────────────────────────────────────────────┘

Density toggle in user menu persists preference.

Row parts:

Checkbox (custom square, accent color when checked, strikethrough title).

Title (truncated, full title on hover).

Tags (max 2 visible, "+N" overflow).

Priority badge (color-coded dot).

Assignee avatar (or "Unassigned").

Due date chip (color: overdue red, today orange, upcoming neutral, completed green).


Hover: shows inline actions (Complete, Edit, More ⋯).

Right-click: context menu (Edit, Duplicate, Copy link, Move to project, Delete).

Click anywhere outside checkbox → opens Task Detail.

Drag handle on left for reorder (only on hover, only when drag enabled in project settings).

4.3 Task Detail (Sheet — default)
Route: /[locale]/(app)/projects/[projectId]?task=:taskId opens a side Sheet over the project page.
File: src/components/task/TaskDetail.tsx
Width: 480 px (desktop), full screen (mobile)

text

Copy
┌──────────────────────────────────────────────────┐  ← X close

│ ● Work · #LOG-12                       ⋯  ⤴ ↗  │  ← more, parent, permalink

│                                                  │

│ [✓]  Fix login bug                               │

│       (inline editable title, click to edit)     │

│                                                  │

│ Status      Open ▾   |  Priority  High ▾        │

│ Assignee    👤 Sara M. ▾   |  Due date  Tue ▾    │

│ Reporter    👤 Ali R.      |  Project  Work     │

│ Tags        [bug ✕] [urgent ✕]  + Add tag       │

│                                                  │

│ Story points  5      (custom field)              │

│ Component     Backend ▾  (custom field)          │

│ QA URL        https://...      (custom field)    │

│                                                  │

│ ┌────────────────────────────────────────────┐   │

│ │ + Add custom field value                   │   │

│ └────────────────────────────────────────────┘   │

│                                                  │

│ ──── Description ────                            │

│ The login page throws 500 when...                │

│ [Edit]                                           │

│                                                  │

│ ──── Subtasks (2) ────                           │

│ ☐ Investigate stack trace                        │

│ ☐ Add error boundary                             │

│ + Add subtask                                    │

│                                                  │

│ ──── Attachments (1) ────                        │

│ 📎 login-screenshot.png · 124 KB · Sara · 2d ago │

│ + Upload                                         │

│                                                  │

│ ──── Comments (3) ────                           │

│ [Sara M. · 2h ago]                               │

│   I think the issue is in the JWT validation.   │

│   ↳ [Ali R. · 1h ago] Confirmed, looking now.   │

│ [Reza K. · 30m ago]                              │

│   @Sara ready for review 👀                      │

│                                                  │

│ [ Write a comment...                @ 📎 ]       │

│       (Cmd+Enter to send)                        │

│                                                  │

│ ──── Activity ────                               │

│ Sara M. changed status from Open to In Progress │

│   2 hours ago                                    │

│ Sara M. assigned to Sara M.  2 hours ago         │

│ Sara M. created this task  3 days ago            │

└──────────────────────────────────────────────────┘
Sections top → bottom:

1.
Header strip — breadcrumb (project + key), close, parent (if subtask), "Open in new tab" → /tasks/[id] (full page).
2.
Title — inline editable; E focuses edit.
3.
Meta row — Status, Priority, Assignee, Reporter, Due date, Project, Tags.
4.
Custom field values — one row per defined field; per-type renderer.
5.
Description — markdown render with edit toggle.
6.
Subtasks — list with inline check; "+ Add subtask" creates child.
7.
Attachments — list with thumbnail (image) or file icon; upload via drag-drop or click.
8.
Comments — threaded; <CommentInput> at bottom.
9.
Activity timeline — audit log entries scoped to this task (collapsed by default, "Show activity").
State variants:


Loading: full-panel skeleton.

Locked / not found: "This task doesn't exist or you don't have access." + back link.

Editing: all sections switch to inline edit; sticky save bar at bottom.

4.4 Task Detail (full page)
Route: /[locale]/(app)/tasks/[taskId]
File: src/app/[locale]/(app)/tasks/[taskId]/page.tsx

Same content as the Sheet but rendered full-page (max-w-960 mx-auto). Used when navigating from a direct link or "Open in new tab."

Adds:


Breadcrumb at top (Project › Task title).

Comments first if task is "done" (V1.1).

4.5 Task Form (create / edit)
File: src/components/task/TaskForm.tsx

Used when "+ Add task" picks "Create full task" or when clicking the title in Task Detail to edit.

Sections (single column, vertical scroll):

1.
Title (required)
2.
Project (required, picker)
3.
Status (default Open)
4.
Priority
5.
Assignee (default: me)
6.
Reporter (default: me)
7.
Due date
8.
Start date
9.
Description (markdown editor with toolbar)
10.
Tags
11.
Recurrence (V1.1 — hidden in V1)
12.
Estimated hours
13.
Custom field values — for the selected project's schema
14.
Subtasks (optional)
Footer: Cancel · Save (sticky).

4.6 Comment Thread
File: src/components/task/CommentThread.tsx + CommentInput.tsx

text

Copy
┌─────────────────────────────────────────────────┐

│ Sara M. · 2h ago · edited                       │

│ I think the issue is in the JWT validation.    │

│                                                 │

│     ↳ Ali R. · 1h ago                           │

│       Confirmed, looking now.                   │

│       [ Reply ]                                 │

│                                                 │

│ Reza K. · 30m ago                               │

│ @Sara ready for review 👀                       │

│ @[Mention user ▾]                               │

│                                                 │

│ [ Write a comment...                  📎 @ ]   │

│     Cmd+Enter to send                           │

└─────────────────────────────────────────────────┘

Markdown supported (bold, italic, code, links, lists).

@mention triggers user picker.

Mention notification fires on send.

Edit own comment within 5 min (shows "edited" tag after).

Delete own comment (soft-delete; "Comment deleted" placeholder).

Threaded up to depth 3; deeper replies flatten to depth 3.

5. Search & Notifications
5.1 Search (Cmd+K dropdown from header)
Trigger: Cmd/Ctrl+K (or click search input)
File: src/components/shell/CommandPalette.tsx

Already described in §0. Distinguishes modes:


Empty input → command list (Navigate, Settings, Help).

Text input → live search across tasks, projects, users, custom-field text values.

5.2 Search Results Page
Route: /[locale]/(app)/search?q=...
File: src/app/[locale]/(app)/search/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ 🔍 [ login bug                                       ]  [ Search ]

├────────────────────────────────────────────────────────────────┤

│ Filters: [Type: Task ▾] [Project ▾] [Status ▾]   Sort: [Relevance ▾]

├────────────────────────────────────────────────────────────────┤

│ Tasks (4)                                                      │

│ ▣ [ ] Fix login bug                  Work · Open    👤 Sara    │

│        Story points: 5 · Component: Backend                    │

│ ▣ [ ] Login bug regression           Work · Done    👤 Ali     │

│ ▣ [ ] Document login flow            Eng · Open     👤 Sara    │

│ ▣ [ ] Login bug retro                Eng · Done     👤 Reza    │

│                                                                │

│ Comments (2)                                                   │

│ Sara M. on "Fix login bug" — 2h ago                            │

│   "...the JWT validation step is failing when..."              │

│                                                                │

│ Projects (1)                                                   │

│ ● Work · 23 tasks                                              │

│                                                                │

│ People (1)                                                     │

│ 👤 Sara M. (sara@corp.com)                                     │

└────────────────────────────────────────────────────────────────┘

Top: search input (focus retained), filter chips.

Body: grouped results (Tasks, Comments, Projects, People, Custom field matches).

Result row: same <TaskRow> for tasks.

Click result → opens it (Sheet or new page depending on type).

Recent searches shown when query is empty.

Empty state: "No results for [q]" + suggested searches.

5.3 Notification Center (dropdown)
Trigger: Bell icon in header
File: src/components/shell/NotificationBell.tsx

text

Copy
┌──────────────────────────────────────────────────────────┐

│ Notifications                                  Mark all read │

├──────────────────────────────────────────────────────────┤

│ 👤 Sara M. assigned you "Fix login bug"           2h ago │

│    Work · High priority · Due Tomorrow                   │

│                                                          │

│ 💬 Reza K. mentioned you on "Update docs"        3h ago │

│    Engineering                                           │

│                                                          │

│ 📅 "Send weekly report" is due today             Today │

│    Work                                                  │

│                                                          │

│ 🔄 Status changed on "API docs" → Done           Yesterday│

│    Engineering                                           │

│                                                          │

│              See all notifications →                    │

└──────────────────────────────────────────────────────────┘

Top 10 unread, sorted by createdAt DESC.

Each row: icon by type, message, project tag, time.

Click row → opens task + marks read.

"Mark all read" button.

"See all notifications →" link to /notifications.

5.4 Notifications Page
Route: /[locale]/(app)/notifications
File: src/app/[locale]/(app)/notifications/page.tsx

Same content as dropdown but full-page, paginated, with filters (All / Unread / by type).

6. User Settings
Layout: src/app/[locale]/(app)/settings/layout.tsx provides a sub-sidebar.

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Settings                                                       │

│  Profile                                                        │

│  Appearance                                                     │

│  Language                                                       │

│  Notifications                                                  │

│  API tokens                                                     │

│  Sessions                                                       │

└────────────────────────────────────────────────────────────────┘
6.1 Profile
Route: /[locale]/(app)/settings/profile
File: src/app/[locale]/(app)/settings/profile/page.tsx

text

Copy
┌──────────────────────────────────────────────────────────────┐

│ Profile                                                       │

├──────────────────────────────────────────────────────────────┤

│  [ Avatar upload (drag-drop) ]                                │

│                                                              │

│  Display name    [ Sara M.                          ]        │

│  Email           [ sara@corp.com        ] (read-only)        │

│  Time zone       [ Asia/Tehran                  ▾ ]           │

│                                                              │

│  Change password     [ Change password ]                      │

│                                                              │

│  ───── Danger zone ─────                                     │

│  Connected identities                                        │

│    • Local (sara@corp.com)                                   │

│    • LDAP (CN=Sara,OU=Eng,DC=corp,DC=com)  [ Unlink ]       │

│    • SAML (NameID: sara@corp.com)            [ Unlink ]       │

│                                                              │

│  Sign out of all other sessions        [ Sign out everywhere ]│

└──────────────────────────────────────────────────────────────┘

Avatar upload: drag-drop or click; max 2 MB; image preview.

Display name validation: 1–60 chars.

Time zone dropdown from Intl.supportedValuesOf('timeZone').

Change password: opens dialog.

Connected identities: one row per AuthIdentity; unlink requires at least one identity remaining.

6.2 Appearance
Route: /[locale]/(app)/settings/appearance
File: src/app/[locale]/(app)/settings/appearance/page.tsx

text

Copy
┌──────────────────────────────────────────────────────────────┐

│ Appearance                                                    │

├──────────────────────────────────────────────────────────────┤

│  Theme                                                       │

│   ( ● ) Light    ( ● ) Dark    ( ● ) System                  │

│                                                              │

│  Accent color                                                 │

│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  ( ● ) Custom    │

│   │● │ │● │ │● │ │● │ │● │ │● │ │● │ │● │  [ #2563eb ]    │

│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                  │

│   Blue  Green  Red   Amber Violet  Pink  Teal  Slate          │

│                                                              │

│  Density                                                      │

│   ( ● ) Compact   ( ● ) Comfortable   ( ● ) Spacious         │

│                                                              │

│  Sidebar                                                      │

│   [▣] Collapse sidebar (persists per device)                 │

└──────────────────────────────────────────────────────────────┘

Live preview: settings panel background reflects current selection immediately.

Custom hex validates + shows AA/AAA contrast badge per background.

6.3 Language
Route: /[locale]/(app)/settings/language
File: src/app/[locale]/(app)/settings/language/page.tsx

text

Copy
┌──────────────────────────────────────────────────────────────┐

│ Language                                                      │

├──────────────────────────────────────────────────────────────┤

│  Display language                                             │

│   ( ● )  فارسی (Persian) — Default                           │

│   ( ● )  English                                              │

│                                                              │

│  Number format                                                │

│   [▣] Use Persian numerals                                   │

│                                                              │

│  Calendar                                                     │

│   ( ● ) Jalali (Solar Hijri) — Default                        │

│   ( ● ) Gregorian                                             │

│                                                              │

│  Time zone          [ Asia/Tehran ▾ ]                        │

│                                                              │

│  First day of week                                            │

│   ( ● ) Saturday — Default                                   │

│   ( ● ) Sunday                                                │

│   ( ● ) Monday                                                │

└──────────────────────────────────────────────────────────────┘
6.4 Notifications
Route: /[locale]/(app)/settings/notifications
File: src/app/[locale]/(app)/settings/notifications/page.tsx

Matrix: per event type × per channel.

text

Copy
┌──────────────────────────────────────────────────────────────┐

│ Notifications                                                 │

├──────────────────────────────────────────────────────────────┤

│                          In-app  Email  Email digest         │

│  Assigned to me             ☑       ☑       —               │

│  Mentioned in comment       ☑       ☑       —               │

│  Comment on watching task   ☑       ☑       —               │

│  Status changed             ☑       ☐       —               │

│  Due soon (24h)             ☑       ☑       —               │

│  Daily digest               —       —       ☑               │

│                                                              │

│  Quiet hours                                                  │

│   [▣] Enable  from [ 22:00 ] to [ 08:00 ]                    │

│   (no in-app or email outside these hours except mentions)   │

└──────────────────────────────────────────────────────────────┘
6.5 API Tokens (user)
Route: /[locale]/(app)/settings/tokens
File: src/app/[locale]/(app)/settings/tokens/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ API tokens                                       [ + New token ]│

├────────────────────────────────────────────────────────────────┤

│ tk_aB3x…   CI pipeline          scopes: tasks:*    Last used 1h │

│            Created Dec 1, 2024            [Revoke]              │

│                                                                │

│ tk_xZ9k…   Local dev            scopes: tasks:read  Last used 3d│

│            Created Nov 20, 2024           [Revoke]              │

│                                                                │

│ tk_pL2m…   Zapier integration   scopes: webhooks:manage Disabled│

│            Expired Dec 1, 2024           [Delete]               │

└────────────────────────────────────────────────────────────────┘

"+ New token" → <ApiTokenCreateDialog>:
text

Copy
Name          [ CI pipeline              ]

Scopes        [✓] tasks:read [✓] tasks:write

              [ ] projects:read ...

Expires       [ Never ▾ ] (1 month / 3 months / 1 year / custom)


[ Cancel ]  [ Generate ]

After generation:
text

Copy
┌──────────────────────────────────────────────────────┐

│ Save this token now — you won't see it again.       │

│                                                      │

│  tk_aB3x9kZpL2mQ7nR4tY8wV...           📋 Copy      │

│                                                      │

│  [ I have saved my token ]                           │

└──────────────────────────────────────────────────────┘

"Revoke" → confirm dialog; instant revoke; existing in-flight requests finish.

Empty state: "No tokens yet" + explanation + "Create your first token."

6.6 Sessions
Route: /[locale]/(app)/settings/sessions
File: src/app/[locale]/(app)/settings/sessions/page.tsx

List of active sessions (device, IP, location, last active, "this device" badge). Per-row "Sign out" + global "Sign out of all other sessions".

7. Admin Screens
Layout: src/app/[locale]/(app)/admin/layout.tsx — RBAC gate (requireRole('admin' | 'owner')) + admin sub-sidebar.

text

Copy
Admin sidebar:

  Overview

  Users

  Departments

  LDAP

  SAML

  SMTP

  Storage

  Audit log

  API tokens (org-wide)

  Webhooks

  Webhook deliveries

  Backups

  Settings (org)
7.1 Admin Overview
Route: /[locale]/(app)/admin
File: src/app/[locale]/(app)/admin/page.tsx

KPI cards + health indicators:


Active users (this week / total).

Tasks created / completed (last 7 days).

API token count + active (last 24h).

Webhook delivery success rate (last 24h).

Audit events (last 24h) by category.

System health: DB pool, Redis, Queue depth, Disk usage.

Recent admin actions (last 10).

7.2 Users
Route: /[locale]/(app)/admin/users
File: src/app/[locale]/(app)/admin/users/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Users (147)                                  [ + Invite user ]│

│ [Search: name, email]   [Role ▾] [Status ▾] [Auth provider ▾] │

├────────────────────────────────────────────────────────────────┤

│ 👤 Sara M.   sara@corp.com   Admin     Local+SAML  Active ⋯  │

│ 👤 Ali R.    ali@corp.com    Member    LDAP        Active ⋯  │

│ 👤 Reza K.   reza@corp.com   Manager   LDAP        Active ⋯  │

│ 👤 Maryam S. maryam@corp.com Member    Local       Suspended ⋯│

│ 👤 Pending   new@corp.com    —         Invited     Invited ⋯  │

└────────────────────────────────────────────────────────────────┘

Bulk select → bulk actions (suspend, change role, send message).

Row actions: View profile, Change role, Suspend/Activate, Force logout, Delete.

"+ Invite user" → dialog: email, role, send invite email.

7.3 User Detail
Route: /[locale]/(app)/admin/users/[userId]
File: src/app/[locale]/(app)/admin/users/[userId]/page.tsx

Tabs: Profile · Roles · Sessions · Tasks · Audit · Settings.

7.4 Departments
Route: /[locale]/(app)/admin/departments
File: src/app/[locale]/(app)/admin/deployments/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Departments                                     [ + Add dept ]│

├────────────────────────────────────────────────────────────────┤

│ ▼ Engineering (12 users, 5 projects)                           │

│   ▼ Backend (5 users, 2 projects)                             │

│       • API team                                              │

│       • DB team                                               │

│   ▼ Frontend (4 users, 2 projects)                            │

│   • DevOps (3 users, 1 project)                               │

│ ▼ Product (5 users, 3 projects)                                │

│ ▼ Operations (8 users, 4 projects)                            │

└────────────────────────────────────────────────────────────────┘

Tree view with expand/collapse.

Per-node: user count, project count, manager.

Drag to reparent.

Import from LDAP group (button per node if LDAP enabled).

7.5 LDAP
Route: /[locale]/(app)/admin/ldap
File: src/app/[locale]/(app)/admin/ldap/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ LDAP / Active Directory                  [Test connection]    │

├────────────────────────────────────────────────────────────────┤

│ ☑ Enabled                                                     │

│                                                              │

│ Server URL           [ ldaps://ldap.corp.example.com:636 ]   │

│ Bind DN              [ cn=svc-taskapp,ou=svc,dc=corp,dc=com ]│

│ Bind password        [ ●●●●●●●● ] 👁                          │

│ Search base          [ ou=people,dc=corp,dc=com ]            │

│ Search filter        [ (&(objectClass=person)(uid={username})) ]│

│ Username attribute   [ uid ]                                 │

│ Email attribute      [ mail ]                                │

│ Name attribute       [ cn ]                                  │

│                                                              │

│ Group sync                                                  │

│ ☑ Sync groups                                                    │

│ Group search base    [ ou=groups,dc=corp,dc=com ]            │

│ Group search filter  [ (member={dn}) ]                       │

│ Admin group DN       [ cn=taskapp-admins,ou=groups,... ]     │

│ Sync interval        [ 60 ] minutes                          │

│ [ Run sync now ]                                              │

│                                                              │

│ TLS                                                       │

│ CA certificate         [ Upload .pem ]                        │

│ ☐ Verify certificate                                         │

│                                                              │

│ Last sync: 2 hours ago · 142 users · 8 groups synced        │

│ Last sync errors: View log →                                 │

│                                                              │

│ [ Cancel ]                              [ Save configuration ]│

└────────────────────────────────────────────────────────────────┘

"Test connection" performs a bind with the configured service account.

"Run sync now" triggers a BullMQ job; result shown in toast with summary.

See AUTH.md for full config schema.

7.6 SAML
Route: /[locale]/(app)/admin/saml
File: src/app/[locale]/(app)/admin/saml/page.tsx

Similar to LDAP, with:


"Upload IdP metadata XML" button — auto-fills entity ID, SSO URL, certificate.

"Test login" button performs SAML round-trip with a test user.

Attribute mapping rows.

Signing/encryption algorithm selectors.

See AUTH.md §5.2 for full schema.

7.7 SMTP
Route: /[locale]/(app)/admin/smtp
File: src/app/[locale]/(app)/admin/smtp/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Email (SMTP)                            [Send test email]    │

├────────────────────────────────────────────────────────────────┤

│ ☑ Enabled                                                     │

│ Host               [ smtp.corp.example.com ]                 │

│ Port               [ 587 ]                                   │

│ ☑ Use TLS / StartTLS                                         │

│ Username           [ taskapp@corp.example.com ]              │

│ Password           [ ●●●●●●●● ] 👁                           │

│ From address       [ taskapp@corp.example.com ]              │

│ From name          [ Acme TaskApp ]                          │

│                                                              │

│ Test send                                                     │

│ Recipient          [ admin@corp.example.com ]                │

│ [ Send test ]                                                 │

│                                                              │

│ [ Cancel ]                              [ Save configuration ]│

└────────────────────────────────────────────────────────────────┘

"Send test email" sends an email using current (potentially unsaved) config to verify.

7.8 Storage
Route: /[locale]/(app)/admin/storage
File: src/app/[locale]/(app)/admin/storage/page.tsx

S3 / MinIO connection settings: endpoint, bucket, region, access key, secret key. "Test connection" performs a head-bucket call.

7.9 Audit Log
Route: /[locale]/(app)/admin/audit
File: src/app/[locale]/(app)/admin/audit/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Audit log                                       [ Export CSV ]│

│ [Date range ▾] [Actor ▾] [Entity ▾] [Action ▾] [ Search ]    │

├────────────────────────────────────────────────────────────────┤

│ When              Actor            Action         Entity      │

│ ─────────────────────────────────────────────────────────────│

│ Dec 2, 14:32     Sara M.          updated        Task #234   │

│                   10.0.5.12        status: Open → In Progress │

│ Dec 2, 14:30     System           created        Comment     │

│                   webhook          on Task #234                │

│ Dec 2, 14:25     Ali R.           login_success  Session     │

│                   10.0.5.34        local                       │

│  …                                                              │

└────────────────────────────────────────────────────────────────┘

Click row → detail dialog: before/after JSON diff.

Filter by date range (preset: today, last 7 days, last 30 days, custom).

Filter by actor (user picker).

Filter by entity type + entity ID.

Filter by action (multi-select).

Cursor pagination.

"Export CSV" downloads current filtered set.

7.10 API Tokens (org-wide view)
Route: /[locale]/(app)/admin/tokens
File: src/app/[locale]/(app)/admin/tokens/page.tsx

Same table as /settings/tokens but shows ALL users' tokens, with owner column. Owner can revoke any token.

7.11 Webhooks
Route: /[locale]/(app)/admin/webhooks
File: src/app/[locale]/(app)/admin/webhooks/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Webhooks (3)                                  [ + New webhook ]│

├────────────────────────────────────────────────────────────────┤

│ Jira sync                              Active · 12 events     │

│ https://jira.corp.com/api/webhook/in    99.2% success (24h) ⋯│

│                                                                │

│ Slack notifications                     Active · 5 events      │

│ https://hooks.slack.com/services/...   100% success (24h)  ⋯ │

│                                                                │

│ Legacy ERP                              Disabled                │

│ https://erp.corp.local/webhook         — ⋯                    │

└────────────────────────────────────────────────────────────────┘

Row click → /admin/webhooks/[id].

⋯ menu: Edit, Enable/Disable, Test, View deliveries, Delete.

"+ New webhook" → <WebhookForm>.

7.12 Webhook Form
File: src/components/admin/WebhookForm.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ New webhook                                                     │

├────────────────────────────────────────────────────────────────┤

│ Name           [ Jira sync                                ]   │

│ Description    [ Two-way sync with Jira issues              ]  │

│                                                               │

│ Target URL     [ https://jira.corp.com/api/webhook/in       ]  │

│                                                               │

│ Events         ☑ task.created                                  │

│                ☑ task.updated                                  │

│                ☑ task.status_changed                           │

│                ☐ task.deleted                                  │

│                ☑ task.assigned                                 │

│                ☑ comment.created                               │

│                ☐ project.created                               │

│                ☐ project.updated                               │

│                ☐ user.created                                  │

│                ☐ custom_field.updated                          │

│                                                               │

│ ☐ Disable SSL verification (not recommended)                  │

│                                                               │

│ Signing secret   generated on save (shown once)               │

│                                                               │

│ [ Cancel ]                                          [ Save ] │

└────────────────────────────────────────────────────────────────┘
On save, show secret once with copy button:

text

Copy
┌──────────────────────────────────────────────────────────────┐

│ Save this signing secret — it will only be shown once.       │

│                                                              │

│ whsec_aB3x9kZpL2mQ7nR4tY8wV1cX5zB...        📋 Copy         │

│                                                              │

│ Verification example (Node.js):                              │

│   crypto.createHmac('sha256', secret)                       │

│         .update(rawBody).digest('hex') === signature        │

│                                                              │

│ [ I have saved my secret ]                                  │

└──────────────────────────────────────────────────────────────┘
7.13 Webhook Detail
Route: /[locale]/(app)/admin/webhooks/[webhookId]
File: src/app/[locale]/(app)/admin/webhooks/[webhookId]/page.tsx

Tabs: Overview · Deliveries · Settings.

Overview:


Name, URL, events list, status toggle.

Stats: deliveries (24h / 7d / 30d), success rate, avg duration, last delivery.

Health badge: Healthy / Degraded / Failing.

Deliveries: filtered list (see 7.14). Settings: edit form.

7.14 Webhook Deliveries
Route: /[locale]/(app)/admin/webhook-deliveries
File: src/app/[locale]/(app)/admin/webhook-deliveries/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Webhook deliveries          [Filter: Webhook ▾] [Status ▾]   │

├────────────────────────────────────────────────────────────────┤

│ When         Webhook     Event         Status    Attempts ⋯ │

│ ─────────────────────────────────────────────────────────────│

│ Dec 2 14:32  Jira sync   task.updated  ✓ 200    1/6      ⋯ │

│               124ms                                    [↻]   │

│ Dec 2 14:30  Jira sync   task.created  ✗ 503    3/6      ⋯ │

│               retry in 30m                            [↻]   │

│ Dec 2 14:25  Slack       comment.created ✓ 200   1/6      ⋯ │

│               89ms                                              │

│ Dec 2 14:00  Jira sync   task.assigned ✗ dead   6/6      ⋯ │

│               dead-letter                                   [↻]│

└────────────────────────────────────────────────────────────────┘

Click row → delivery detail drawer with full request/response, retry button.

"Replay" sends a new delivery for the same event.

Status badges: success (green), retrying (amber), failed_dead (red), in_flight (blue).

7.15 Backups
Route: /[locale]/(app)/admin/backups
File: src/app/[locale]/(app)/admin/backups/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Backups                                       [ Run backup now ]│

├────────────────────────────────────────────────────────────────┤

│ Last backup: Dec 2, 02:00 · 412 MB · Status: ✓ success       │

│ Next: Dec 3, 02:00 (in 13h)                                  │

│                                                              │

│ Schedule: [ 0 2 * * * ] (cron)                               │

│ Retention: [ 30 ] days                                       │

│ Destination: [ S3 ▾ ] (corp-backups bucket)                  │

│                                                              │

│ Recent backups                                                │

│ Dec 2, 02:00   412 MB  ✓   [ Download ] [ Restore ]          │

│ Dec 1, 02:00   408 MB  ✓   [ Download ] [ Restore ]          │

│ Nov 30, 02:00  405 MB  ✓   [ Download ] [ Restore ]          │

│  …                                                             │

│                                                              │

│ Restore from upload                                          │

│ [ Drop a .dump file here or click to upload ]                │

└────────────────────────────────────────────────────────────────┘

"Run backup now" triggers immediate BullMQ job; result in toast.

"Restore" requires typing the project name as confirmation.

7.16 Settings (org)
Route: /[locale]/(app)/admin/settings
File: src/app/[locale]/(app)/admin/settings/page.tsx

Sections:


General: site name, logo upload, default locale, default accent, default density.

Security: session timeout (idle + absolute), password policy (min length, complexity, expiry), max concurrent sessions per user.

Features: enable/disable webhooks per install, enable/disable API tokens per install, enable/disable custom fields per install.

Webhooks (system): rotate the WEBHOOK_SECRET_ENCRYPTION_KEY (re-encrypts all secrets).

License: license key input (if applicable).

8. Dashboards
8.1 My Dashboard
Route: /[locale]/(app)/dashboard
File: src/app/[locale]/(app)/dashboard/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Good afternoon, Sara                                          │

│ 5 tasks today · 3 overdue                                     │

├────────────────────────────────────────────────────────────────┤

│ [ Today ▼ ]   Add a task                                      │

│                                                                │

│ TODAY (5)                                                      │

│ ▣ [ ] Reply to Acme email            Work · 4:00 PM        👤  │

│ ▣ [ ] Update deployment docs         Eng · 5:00 PM         👤  │

│  … (3 more)                                                    │

│                                                                │

│ UPCOMING (8)                                                   │

│ Tomorrow                                                      │

│ ▣ [ ] Prepare sprint demo            Product               👤  │

│  …                                                             │

│                                                                │

│ OVERDUE (3)                                                    │

│ ▣ [ ] Send weekly report             Work · Due Mon        👤  │

│  …                                                             │

│                                                                │

│ RECENT ACTIVITY (last 10)                                      │

│ Sara M. completed "Update docs"             2h ago             │

│ Ali R. commented on "Fix login bug"        3h ago             │

│ Reza K. assigned you "API integration"     Yesterday           │

└────────────────────────────────────────────────────────────────┘

Greets user with localized time-of-day (Good morning / afternoon / evening per locale).

Sections collapsible.

Each section: "View all" link to the corresponding full page.

8.2 Project Dashboard
See §3.3.

8.3 Org Dashboard
Route: /[locale]/(app)/admin/insights (or /admin/insights)
File: src/app/[locale]/(app)/admin/insights/page.tsx

text

Copy
┌────────────────────────────────────────────────────────────────┐

│ Organization insights                                          │

│ Last 30 days                                                   │

├────────────────────────────────────────────────────────────────┤

│ KPI cards: Active users · Tasks created · Tasks completed ·   │

│           API calls · Webhook deliveries · Webhook success %   │

│                                                                │

│ Activity over time (line chart, daily)                         │

│                                                                │

│ Top projects (bar chart, by tasks completed)                   │

│ Top users (bar chart, by tasks completed)                     │

│                                                                │

│ Webhook health (per webhook, last 24h, success % bar)          │

│ API token usage (top 10 tokens, last 24h)                      │

│                                                                │

│ Audit highlights (last 10 admin-relevant events)               │

└────────────────────────────────────────────────────────────────┘
9. Modals, Drawers, Toasts — Catalog
9.1 Confirm Dialog (destructive)
text

Copy
┌─────────────────────────────────────────┐

│ Delete task?                  [X]      │

│                                         │

│ "Fix login bug" will be moved to trash  │

│ and deleted after 30 days.              │

│                                         │

│ [ Cancel ]            [ Delete task ]   │

└─────────────────────────────────────────┘
Used for: delete task, delete project, delete webhook, revoke token, restore from backup.

For highly destructive (e.g., reset DB): require typing project/install name.

9.2 Form Sheet (create/edit)
Side sheet (480 px) with form, sticky footer (Cancel / Save), Esc closes, click outside saves draft.

Used for: New project, New task, New webhook, Edit custom field, Invite user.

9.3 Undo Toast (transient)
text

Copy
┌──────────────────────────────────────────────┐

│ Task "Fix login bug" deleted        [ Undo ] │

└──────────────────────────────────────────────┘
Bottom-right (LTR) / bottom-left (RTL). Auto-dismisses in 5s. Click Undo reverses the action; on dismiss, action commits.

Used for: delete task, delete comment, archive project, etc.

9.4 Toast Variants

Info: neutral, used for general feedback.

Success: green check, e.g., "Saved."

Warning: amber, e.g., "Webhook delivery failed (will retry)."

Error: red, e.g., "Couldn't save — try again." + "Copy error details."

Stacking: max 3 visible; older collapse to a "+2 more" pill.

10. State Library — Catalog of Empty / Loading / Error Screens
For consistency, every list-style screen renders one of these state components.

10.1 Empty States
Each empty state has: illustration (120×120, line style), headline, 1-line description, optional primary CTA.

Screen	Headline	Description	CTA
Inbox (empty)	"Your inbox is clear"	"Tasks you're watching or that need you will show up here."	—
Today (empty)	"Nothing due today"	"Take a breath — or plan ahead."	"View upcoming →"
Upcoming (empty)	"No upcoming tasks"	"Tasks with future due dates will appear here."	"+ Add task"
My Tasks (empty)	"You're all caught up"	"No tasks assigned to you. Nice."	—
All (empty)	"No tasks match your filters"	"Try adjusting filters or clear them."	"Clear filters"
Project list (empty)	"No tasks in this project yet"	"Create the first task to get started."	"+ Add task"
Project dashboard (empty)	"No data to show"	"Charts appear after the first task is created."	—
Projects grid (empty)	"No projects yet"	"Create a project to organize your tasks."	"+ New Project"
Search (empty)	"No results"	"Try different keywords or remove filters."	"Clear filters"
Notifications (empty)	"No notifications"	"You're all caught up."	—
Comments on task (empty)	"No comments yet"	"Be the first to comment."	(input always visible)
API tokens (empty)	"No API tokens"	"Create a token to integrate with external systems."	"+ New token"
Webhooks (empty)	"No webhooks"	"Subscribe to events and send them to your services."	"+ New webhook"
Audit (empty)	"No events match your filters"	"Try widening the date range or removing filters."	"Clear filters"
LDAP users synced (empty)	"No users synced yet"	"Run sync to import users from LDAP."	"Run sync now"
10.2 Loading States
Per-screen skeletons matching final layout. Examples:


Task list: 8 placeholder rows (40 / 56 / 88 px tall per density), muted bg, shimmer.

Project dashboard: 4 KPI placeholders + chart placeholders.

Settings pages: form field placeholders.

Admin tables: row placeholders with column widths matching real data.

Global loading bar: top-of-page progress indicator for navigation (NProgress-style, but minimal — thin bar in accent color).

10.3 Error States

Inline form error: red border + helper text under field.

Toast error: see 9.4.

Route error: full-page <ErrorState> with:
text

Copy
┌─────────────────────────────────────────┐

│           ⚠ Couldn't load this page    │

│                                         │

│  Something went wrong on our side.      │

│  Try again, or contact support if it    │

│  persists.                              │

│                                         │

│  [ Try again ]   [ Go to dashboard ]    │

│                                         │

│  Error details: request id ...          │

│  [ Copy details ]                       │

└─────────────────────────────────────────┘

404:
text

Copy
┌─────────────────────────────────────────┐

│           🔍 Page not found             │

│                                         │

│  We couldn't find what you're looking   │

│  for. It may have been deleted or       │

│  moved.                                 │

│                                         │

│  [ Go to dashboard ]                    │

└─────────────────────────────────────────┘

403 (insufficient permission):
text

Copy
┌─────────────────────────────────────────┐

│           🔒 Access denied              │

│                                         │

│  You don't have permission to view      │

│  this. Ask your admin for access.       │

│                                         │

│  [ Go to dashboard ]                    │

└─────────────────────────────────────────┘

10.4 Offline (V1.1)
Not in V1. Hook in the SW infrastructure for V1.1.

11. Keyboard Map (master reference)
Key	Context	Action
Cmd/Ctrl+K	global	Open command palette / quick add
/	global	Focus search
C	list view	New task in current project
G I / G T / G U / G A / G P	global	Go to Inbox / Today / Upcoming / All / Projects
1–4	sidebar	Focus sidebar items 1–4
J / K	list	Move focus down / up
X	list	Toggle select on focused row
Cmd/Ctrl+A	list	Select all on page
E	task	Edit focused task
Space	task	Toggle complete
Del	task	Delete (with undo)
M	task	Assign (opens picker)
T	task	Set due date (opens picker)
P	task	Set priority
L	task	Add label / tag
Cmd/Ctrl+Enter	form	Save & close
Esc	modal/sheet	Close (with unsaved-changes confirm)
?	global	Show shortcut help overlay
Cmd/Ctrl+,	global	Open settings
Shortcut help overlay (?):


Modal with all shortcuts grouped: Global · Navigation · Tasks · Forms.

Search box at top to filter.

Esc closes.

12. Permission Matrix (UI-level summary)
Screen	Min role
/login/*, /invite/*, /forgot-password	unauthenticated
/dashboard, /today, /upcoming, /my-tasks, /inbox, /all	authenticated
/projects	authenticated (lists visible projects)
/projects/[id]	project member or visibility matches
/projects/[id]/members, custom-fields, settings	project lead / admin / owner
/settings/*	self
/search	authenticated
/notifications	authenticated (own)
/admin and all sub-routes	admin or owner
/admin/users, /admin/departments	admin or owner
/admin/ldap, /admin/saml, /admin/smtp, /admin/storage	owner
/admin/audit, /admin/webhooks, /admin/webhook-deliveries	admin or owner
/admin/backups, /admin/settings	owner
UI enforcement: server-side requirePermission() middleware on every API; client-side <Can action="..."> only for hiding controls (never the sole gate).

13. Responsive Behavior (per screen)
Screen	< 768 px (mobile)	768–1024 (tablet)	> 1024 (desktop)
Sidebar	hidden, replaced by bottom tab bar	collapsed (64 px)	expanded (240 px)
Header	logo + bell + avatar (search behind cmd+k)	full	full
Task list	card stack	compact rows	full rows
Task detail	full-page modal	side sheet	side sheet
Project view	tabs full-width; board scrolls horizontally	full	full
Admin	tabs collapsed into menu	sub-sidebar collapsed	full sub-sidebar
Tables	horizontal scroll or card transform	full	full
Charts	simplified (single axis labels, smaller fonts)	full	full
Modals	full-screen	sheet	sheet (default) or dialog
Dashboard	single column	2 columns	4 columns KPI
14. Accessibility Requirements (per screen)
Every screen must pass @axe-core/playwright with zero violations:


Color contrast ≥ 4.5:1 for body text.

All interactive elements keyboard reachable in DOM order.

Focus ring visible (ring-2 ring-accent-ring ring-offset-2).

All icon-only buttons have aria-label.

All form inputs have <label> association.

Live regions (aria-live="polite") for toast and inline confirmations.

Headings hierarchy: one <h1> per page, no skipped levels.

Tables use <th scope>.

Lists use semantic <ul> / <ol>.

Landmarks: <header>, <nav>, <main>, <aside>, <footer>.

Modals: focus trap, focus restoration, Esc closes.

Skip-to-content link as first focusable element.

15. Internationalization Requirements (per screen)
Per-screen i18n keys live in messages/fa-IR.json and messages/en-US.json.

Each screen declares its keys at the top of the page file as a comment for pnpm i18n:extract to pick up:

ts

Copy
// i18n keys: views.inbox.title, views.inbox.empty.title, views.inbox.empty.description
Conventions:


All user-visible strings translated.

All dates formatted via useFormattedDate().

All numbers via Intl.NumberFormat(locale).

RTL layout: components use logical CSS properties only.

All inputs have dir="auto" so RTL/LTR mixed content (e.g., email in Persian sentence) renders correctly.

Last updated: kickoff v0.3
Next review: end of Phase 9 (design system implementation)

