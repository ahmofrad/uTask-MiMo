"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

type TaskQuickAddProps = {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  onCreated?: () => void;
};

export function TaskQuickAdd({ open, onClose, projectId, onCreated }: TaskQuickAddProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), projectId: projectId ?? undefined }),
      });
      setTitle("");
      onCreated?.();
      onClose();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-4">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className={cn(
              "w-full bg-transparent text-base text-fg placeholder:text-fg-subtle",
              "outline-none border-none",
            )}
            disabled={saving}
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-xs text-fg-subtle">
              Press Enter to create, Esc to cancel
            </span>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="px-3 py-1 text-sm font-medium bg-accent text-fg-inverse rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
