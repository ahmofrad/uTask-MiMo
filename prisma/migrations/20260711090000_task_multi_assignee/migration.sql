-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- Backfill existing single assignees into the join table (must run before
-- the assigneeId column is dropped).
INSERT INTO "TaskAssignee" ("id", "taskId", "userId", "createdAt")
SELECT gen_random_uuid(), "id", "assigneeId", now()
FROM "Task"
WHERE "assigneeId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignee_taskId_userId_key" ON "TaskAssignee"("taskId", "userId");
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");
CREATE INDEX "TaskAssignee_taskId_idx" ON "TaskAssignee"("taskId");

-- Drop the now-replaced single assignee column (cascades its FK + index).
ALTER TABLE "Task" DROP COLUMN "assigneeId";
