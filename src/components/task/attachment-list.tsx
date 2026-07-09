"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type AttachmentListProps = {
  attachments: Attachment[];
  onUpload: (_file: File) => Promise<void>;
  onDelete?: (_id: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "📦";
  return "📎";
}

export function AttachmentList({ attachments, onUpload, onDelete }: AttachmentListProps) {
  const ta = useTranslations("task");
  const tc = useTranslations();
  const { shortDate } = useFormattedDate();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-fg-primary">
          {ta("attachments")} ({attachments.length})
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          {uploading ? tc("common.loading") : ta("upload")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      <div className="space-y-2">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg bg-bg-surface border border-border-primary">
            <span className="text-lg">{getFileIcon(att.mimeType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-fg-primary truncate">{att.filename}</p>
              <p className="text-xs text-fg-muted">
                {formatSize(att.sizeBytes)} · {shortDate(att.createdAt)}
              </p>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(att.id)}
                className="text-xs text-fg-muted hover:text-destructive transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
