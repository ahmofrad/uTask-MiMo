"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type UndoToastProps = {
  message: string;
  onUndo: () => void;
  durationMs?: number;
  onDismiss?: () => void;
};

export function UndoToast({
  message,
  onUndo,
  durationMs = 5000,
  onDismiss,
}: UndoToastProps) {
  const t = useTranslations();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 end-4 z-50 animate-in slide-in-from-right">
      <div className="flex items-center gap-3 bg-bg-primary border border-border-primary rounded-lg shadow-xl px-4 py-3 text-sm">
        <span className="flex-1 text-fg-primary">{message}</span>
        <button
          onClick={() => {
            onUndo();
            setVisible(false);
          }}
          className="text-accent hover:underline font-medium shrink-0"
        >
          {t("common.undo")}
        </button>
      </div>
    </div>
  );
}
