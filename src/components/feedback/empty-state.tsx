"use client";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  titleKey: string;
  descriptionKey: string;
  cta?: { labelKey: string; onClick: () => void };
};

export function EmptyState({ icon, titleKey, descriptionKey, cta }: EmptyStateProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-fg-muted">{icon}</div>}
      <h3 className="text-lg font-medium text-fg-primary mb-2">{t(titleKey)}</h3>
      <p className="text-sm text-fg-muted max-w-sm mb-6">{t(descriptionKey)}</p>
      {cta && (
        <button
          onClick={cta.onClick}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          {t(cta.labelKey)}
        </button>
      )}
    </div>
  );
}
