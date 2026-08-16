-- Audit actions for group / membership / grant mutations (RBAC ticket #4).
-- Postgres enums only allow appending values; these are additive.
ALTER TYPE "AuditAction" ADD VALUE 'group_created';
ALTER TYPE "AuditAction" ADD VALUE 'group_updated';
ALTER TYPE "AuditAction" ADD VALUE 'group_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'group_member_added';
ALTER TYPE "AuditAction" ADD VALUE 'group_member_removed';
ALTER TYPE "AuditAction" ADD VALUE 'group_grant_created';
ALTER TYPE "AuditAction" ADD VALUE 'group_grant_revoked';
