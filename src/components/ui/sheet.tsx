"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "left" | "right";
};

export function Sheet({ open, onClose, title, children, side = "right" }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30">
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className={cn(
        "absolute top-0 h-full w-64 max-w-[70vw] bg-bg-surface shadow-xl flex flex-col animate-in duration-200",
        side === "left" && "left-0 border-e border-border slide-in-from-left",
        side === "right" && "right-0 border-s border-border slide-in-from-right",
      )}>
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close">
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
