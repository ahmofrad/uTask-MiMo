"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/sheet";
import { useTranslations } from "next-intl";

type MobileNavProps = {
  isAdmin: boolean;
};

export function MobileNav({ isAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 text-fg-secondary hover:text-fg-primary"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="uTask" side="right">
        <nav className="space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary">{t("home")}</Link>
          <Link href="/projects" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary">{t("projects")}</Link>
          <Link href="/calendar" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary">{t("calendar")}</Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary">{t("settings")}</Link>
          {isAdmin && <Link href="/admin/users" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-md text-fg-secondary hover:bg-bg-primary">{t("admin")}</Link>}
        </nav>
      </Sheet>
    </>
  );
}
