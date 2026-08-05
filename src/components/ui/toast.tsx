"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";

type ToastItem = {
  id: string;
  message: string;
  action?: { label: string; onClick: () => void };
};

type ToastContextType = {
  toasts: ToastItem[];
  addToast: (_toast: Omit<ToastItem, "id">) => void;
  removeToast: (_id: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

const AUTO_DISMISS_MS = 8000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const t = useTranslations("common");

  const addToast = useCallback((_toast: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ..._toast, id }]);
    if (!_toast.action) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, AUTO_DISMISS_MS);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-sm"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-bg-primary border border-border-primary rounded-lg shadow-xl px-4 py-3 text-sm text-fg-primary flex items-center gap-3 animate-in slide-in-from-bottom duration-200"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  removeToast(toast.id);
                }}
                className="text-accent hover:underline font-medium shrink-0"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="text-fg-tertiary hover:text-fg-primary shrink-0 ms-2"
              aria-label={t("dismiss")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
