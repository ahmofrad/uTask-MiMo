-- CreateEnum
CREATE TYPE "DepartmentManagerSource" AS ENUM ('ad', 'manual');

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "managerSource" "DepartmentManagerSource";

-- AlterTable
ALTER TABLE "LdapSyncGroup" ADD COLUMN     "managerDn" VARCHAR(512);
