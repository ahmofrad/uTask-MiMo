"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { CommentData, TranslateFn } from "./task-mutations/types";

type Options = {
  taskId: string;
  initialComments: CommentData[];
  t: TranslateFn;
};

/**
 * Owns the comments list and comment mutations (add / edit / delete) for the
 * task detail page. Optimistic-free: refetches nothing, appends/updates from
 * server responses so the list always mirrors the API.
 */
export function useTaskComments({ taskId, initialComments, t }: Options) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);

  const addComment = useCallback(async (body: string) => {
    const res = await apiFetch(`/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ bodyMarkdown: body }),
    });
    if (!res.ok) throw new Error(t("task.commentFailed"));
    const result = await res.json();
    setComments((prev) => [
      ...prev,
      {
        id: result.data.id,
        body: result.data.bodyMarkdown,
        createdAt: result.data.createdAt,
        authorId: result.data.authorId,
        author: { displayName: result.data.author.displayName, avatarUrl: result.data.author.avatarUrl },
      },
    ]);
  }, [taskId, t]);

  const updateComment = useCallback(async (id: string, body: string) => {
    const res = await apiFetch(`/api/v1/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ bodyMarkdown: body }),
    });
    if (res.ok) {
      const result = await res.json();
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, body: result.data.bodyMarkdown } : c));
    }
  }, []);

  const deleteComment = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/v1/comments/${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { comments, addComment, updateComment, deleteComment };
}