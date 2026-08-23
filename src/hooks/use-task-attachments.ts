"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { AttachmentData } from "./task-mutations/types";

type Options = {
  taskId: string;
  initialAttachments: AttachmentData[];
};

/** Attachment list + upload/delete for the task detail page. */
export function useTaskAttachments({ taskId, initialAttachments }: Options) {
  const [attachments, setAttachments] = useState<AttachmentData[]>(initialAttachments);

  const uploadAttachment = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiFetch(`/api/v1/tasks/${taskId}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const result = await res.json();
      setAttachments((prev) => [result.data, ...prev]);
    }
  }, [taskId]);

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    const res = await apiFetch(`/api/v1/tasks/${taskId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    }
  }, [taskId]);

  return { attachments, uploadAttachment, deleteAttachment };
}