-- Add TOTP two-factor authentication fields and per-user datetime preferences.
ALTER TABLE "User" ADD COLUMN "timeZone" VARCHAR(64);
ALTER TABLE "User" ADD COLUMN "timeFormat" VARCHAR(3) NOT NULL DEFAULT 'H24';
ALTER TABLE "User" ADD COLUMN "dualCalendar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpSecret" VARCHAR(255);
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpRecoveryCodesHashed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];