"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "start" | "end";
};

export function Sheet({ open, onClose, title, children, side = "start" }: SheetProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "fa-IR";
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

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

  const fromStart = side === "start";
  const atRightEdge = isRtl ? fromStart : !fromStart;
  const positionClass = cn(
    fromStart ? "start-0 border-e" : "end-0 border-s",
    atRightEdge ? "slide-in-from-right" : "slide-in-from-left",
  );

  return (
    <div className="fixed inset-0 z-30">
      <div
        className="absolute inset-0 bg-bg-overlay animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute top-0 h-full w-64 max-w-[70vw] bg-bg-surface shadow-xl flex flex-col animate-in duration-200 focus:outline-none",
          positionClass,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 text-fg-muted hover:text-fg"
              aria-label={t("close")}
            >
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
