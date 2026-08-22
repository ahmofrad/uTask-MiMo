-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "userId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateIndex
CREATE INDEX "DepartmentMembership_departmentId_idx" ON "DepartmentMembership"("departmentId");

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'department_member_added';
ALTER TYPE "AuditAction" ADD VALUE 'department_member_removed';
