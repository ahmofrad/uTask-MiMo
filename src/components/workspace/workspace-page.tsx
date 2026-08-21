"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons/icon";
import type { IconName } from "@/components/icons/registry";
import { buildWorkspaceTiles } from "@/lib/workspace/tiles";

type WorkspacePageProps = {
  isAdmin: boolean;
};

export function WorkspacePage({ isAdmin }: WorkspacePageProps) {
  const t = useTranslations("workspace");
  const tiles = buildWorkspaceTiles(isAdmin);

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-fg tracking-tight">{t("title")}</h1>
        <p className="text-fg-muted mt-1">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group rounded-xl border border-border bg-bg-surface p-5 shadow-sm hover:border-accent/40 hover:bg-bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-bg text-accent group-hover:bg-accent group-hover:text-fg-inverse transition-colors">
                <Icon name={tile.icon as IconName} size={20} aria-hidden />
              </span>
              <span className="font-semibold text-fg">{t(tile.titleKey)}</span>
            </div>
            <p className="text-sm text-fg-muted">{t(tile.descKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
