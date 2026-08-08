-- Track approval of additional department links without granting access before review.
CREATE TYPE "ProjectDepartmentLinkRequestStatus" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'revoked'
);

CREATE TABLE "ProjectDepartmentLinkRequest" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "reviewedById" UUID,
  "status" "ProjectDepartmentLinkRequestStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMPTZ,

  CONSTRAINT "ProjectDepartmentLinkRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectDepartmentLinkRequest_projectId_departmentId_status_idx"
  ON "ProjectDepartmentLinkRequest"("projectId", "departmentId", "status");

CREATE INDEX "ProjectDepartmentLinkRequest_departmentId_status_idx"
  ON "ProjectDepartmentLinkRequest"("departmentId", "status");

ALTER TABLE "ProjectDepartmentLinkRequest"
  ADD CONSTRAINT "ProjectDepartmentLinkRequest_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectDepartmentLinkRequest"
  ADD CONSTRAINT "ProjectDepartmentLinkRequest_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectDepartmentLinkRequest"
  ADD CONSTRAINT "ProjectDepartmentLinkRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectDepartmentLinkRequest"
  ADD CONSTRAINT "ProjectDepartmentLinkRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
