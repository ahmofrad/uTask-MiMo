-- AuditLog.entityId holds either a row UUID or a stable key for non-row
-- entities (e.g. settings sections "sso"/"smtp"/"storage", backups "manual",
-- ldap sync "all", or "" for anonymous failed-login events). The UUID column
-- type made those audit writes fail with P2023, 500-ing the routes. Widen to
-- text; the partitioned parent cascades the change to every monthly partition.
ALTER TABLE "AuditLog" ALTER COLUMN "entityId" SET DATA TYPE VARCHAR(512);
