-- Materialized views for reports
-- These pre-compute aggregate statistics to avoid expensive live queries

-- Per-project task statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_task_stats AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL) AS total_tasks,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'open') AS open_tasks,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'in_progress') AS in_progress_tasks,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'done') AS done_tasks,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'cancelled') AS cancelled_tasks,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."dueDate" < NOW() AND t."status" != 'done') AS overdue_tasks,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'done' AND t."updatedAt" >= DATE_TRUNC('month', NOW())) AS completed_this_month,
  COUNT(t.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'done' AND t."updatedAt" >= NOW() - INTERVAL '7 days') AS completed_this_week
FROM "Project" p
LEFT JOIN "Task" t ON t."projectId" = p.id
WHERE p."archivedAt" IS NULL
GROUP BY p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_task_stats_project_id ON mv_project_task_stats (project_id);

-- Per-user task statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_task_stats AS
SELECT
  u.id AS user_id,
  COUNT(ta.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" != 'done') AS assigned_active,
  COUNT(ta.id) FILTER (WHERE t."deletedAt" IS NULL AND t."dueDate" < NOW() AND t."status" != 'done') AS assigned_overdue,
  COUNT(ta.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'done' AND t."updatedAt" >= NOW() - INTERVAL '7 days') AS completed_this_week,
  COUNT(ta.id) FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'done' AND t."updatedAt" >= DATE_TRUNC('month', NOW())) AS completed_this_month
FROM "User" u
LEFT JOIN "TaskAssignee" ta ON ta."userId" = u.id
LEFT JOIN "Task" t ON t.id = ta."taskId"
WHERE u.status = 'active'
GROUP BY u.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_task_stats_user_id ON mv_user_task_stats (user_id);

-- Org-wide statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_org_stats AS
SELECT
  (SELECT COUNT(*) FROM "User" WHERE status = 'active') AS total_users,
  (SELECT COUNT(*) FROM "Project" WHERE "archivedAt" IS NULL) AS total_projects,
  (SELECT COUNT(*) FROM "Task" WHERE "deletedAt" IS NULL) AS total_tasks,
  (SELECT COUNT(*) FROM "Task" WHERE "deletedAt" IS NULL AND status = 'done') AS completed_tasks,
  (SELECT COUNT(*) FROM "Task" WHERE "deletedAt" IS NULL AND "dueDate" < NOW() AND status != 'done') AS overdue_tasks;
