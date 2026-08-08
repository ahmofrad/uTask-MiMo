-- Normalize project ownership links while retaining Project.departmentId for compatibility.
CREATE TABLE "ProjectDepartment" (
  "projectId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectDepartment_pkey" PRIMARY KEY ("projectId", "departmentId")
);

INSERT INTO "ProjectDepartment" ("projectId", "departmentId")
SELECT "id", "departmentId"
FROM "Project"
WHERE "departmentId" IS NOT NULL
ON CONFLICT ("projectId", "departmentId") DO NOTHING;

CREATE INDEX "ProjectDepartment_departmentId_projectId_idx"
  ON "ProjectDepartment"("departmentId", "projectId");

ALTER TABLE "ProjectDepartment"
  ADD CONSTRAINT "ProjectDepartment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectDepartment"
  ADD CONSTRAINT "ProjectDepartment_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
