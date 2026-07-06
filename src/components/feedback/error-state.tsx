"use client";

import { useTranslations } from "next-intl";

type ErrorStateProps = {
  message?: string;
  requestId?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, requestId, onRetry }: ErrorStateProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-danger-bg flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-fg-primary mb-2">{t("common.error")}</h3>
      <p className="text-sm text-fg-muted max-w-sm mb-4">
        {message || t("common.error")}
      </p>
      {requestId && (
        <p className="text-xs text-fg-muted mb-4">Request ID: {requestId}</p>
      )}
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
          >
            {t("common.retry")}
          </button>
        )}
      </div>
    </div>
  );
}
