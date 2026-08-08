ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'project_department_link_requested';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'project_department_link_approved';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'project_department_link_rejected';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'project_department_link_cancelled';
