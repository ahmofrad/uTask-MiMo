import { prisma } from "@/lib/db";
import { putObject } from "@/lib/storage/upload";
import { removeObject } from "@/lib/storage/delete";
import { presignedGet } from "@/lib/storage/download";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { randomUUID } from "@/lib/crypto";
import type { AuditAction } from "@prisma/client";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export { MAX_FILE_SIZE };

export async function getAttachmentsByTask(taskId: string) {
  return prisma.attachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPresignedUrl(attachmentId: string, taskId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.taskId !== taskId) return null;
  return presignedGet(attachment.storageKey);
}

export async function createAttachment(
  taskId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
  uploadedById: string,
) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 25 MB limit");
  }

  const storageKey = `tasks/${taskId}/${randomUUID()}-${file.name}`;
  await putObject(storageKey, file.buffer, file.type);

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
      uploadedById,
    },
  });

  await logAudit({
    actorUserId: uploadedById,
    action: "created" as AuditAction,
    entityType: "attachment",
    entityId: attachment.id,
    after: { taskId, filename: file.name } as never,
  });

  await emitTaskEvent("attachment.created", taskId, {
    id: attachment.id,
    taskId,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  }, uploadedById);

  return attachment;
}

export async function updateAttachment(
  attachmentId: string,
  taskId: string,
  actorId: string,
  data: { name: string },
) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, taskId: true, filename: true },
  });

  if (!attachment || attachment.taskId !== taskId) {
    throw new Error("Attachment not found");
  }

  const before = { taskId, filename: attachment.filename } as never;

  const updated = await prisma.attachment.update({
    where: { id: attachmentId },
    data: { filename: data.name },
  });

  await logAudit({
    actorUserId: actorId,
    action: "updated" as AuditAction,
    entityType: "attachment",
    entityId: attachment.id,
    before,
    after: { taskId, filename: updated.filename } as never,
  });

  await emitTaskEvent("attachment.updated", taskId, {
    id: updated.id,
    taskId,
    filename: updated.filename,
    mimeType: updated.mimeType,
    sizeBytes: updated.sizeBytes,
  }, actorId);

  return updated;
}

export async function deleteAttachment(attachmentId: string, taskId: string, actorId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, storageKey: true, filename: true, taskId: true },
  });

  if (!attachment || attachment.taskId !== taskId) {
    throw new Error("Attachment not found");
  }

  await removeObject(attachment.storageKey);

  await prisma.attachment.delete({ where: { id: attachmentId } });

  await logAudit({
    actorUserId: actorId,
    action: "deleted" as AuditAction,
    entityType: "attachment",
    entityId: attachment.id,
    before: { taskId, filename: attachment.filename } as never,
  });

  await emitTaskEvent("attachment.deleted", taskId, {
    id: attachment.id,
    taskId,
    filename: attachment.filename,
  }, actorId);
}