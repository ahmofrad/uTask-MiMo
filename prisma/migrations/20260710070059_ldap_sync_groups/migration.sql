-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'ldapGroupRemoved';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ldapGroup" VARCHAR(255),
ADD COLUMN     "ldapGroupId" UUID;

-- CreateTable
CREATE TABLE "LdapSyncGroup" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "dn" VARCHAR(512) NOT NULL,
    "lastSyncedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LdapSyncGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LdapSyncGroup_dn_key" ON "LdapSyncGroup"("dn");
