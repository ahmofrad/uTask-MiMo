-- Add new values to AuditAction enum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'api_token_created';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'api_token_revoked';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'webhook_created';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'webhook_updated';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'webhook_deleted';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'webhook_tested';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'webhook_delivery_replayed';
