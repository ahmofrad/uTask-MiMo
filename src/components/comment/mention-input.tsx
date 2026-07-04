"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

type MentionInputProps = {
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
};

export function MentionInput({ value, onChange, placeholder, minRows = 3, maxRows = 12, className }: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const minH = minRows * lineHeight;
    const maxH = maxRows * lineHeight;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        autoResize();
      }}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-fg",
        "placeholder:text-fg-subtle resize-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
        className,
      )}
    />
  );
}
