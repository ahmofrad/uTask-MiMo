"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { TagsManager } from "@/components/tags/tags-manager";
import { apiFetch } from "@/lib/api-fetch";

type TagData = {
  id: string;
  name: string;
  color: string;
  _count?: { tasks: number };
};

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

export function TagsModal({ projectId, open, onClose, onChanged }: Props) {
  const t = useTranslations("task");
  const [tags, setTags] = useState<TagData[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setTags(null);
    apiFetch(`/api/v1/tags?projectId=${projectId}`)
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json();
          setTags(body.data ?? []);
        }
      })
      .catch(() => setTags([]));
  }, [open, projectId]);

  return (
    <Dialog open={open} onClose={onClose} title={t("manageTags")}>
      {tags === null ? (
        <p className="text-sm text-fg-muted">{t("loading")}</p>
      ) : (
        <TagsManager
          projectId={projectId}
          initialTags={tags}
          onChange={() => onChanged?.()}
        />
      )}
    </Dialog>
  );
}
