-- AlterEnum
-- PostgreSQL enums cannot drop or reorder values; adding one value per
-- statement (convention for multi-value enum additions, see
-- 20260710074821_ldap_audit_actions).

ALTER TYPE "AuditAction" ADD VALUE 'ldap_source_created';
ALTER TYPE "AuditAction" ADD VALUE 'ldap_source_updated';
ALTER TYPE "AuditAction" ADD VALUE 'ldap_source_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'ldap_source_tested';
