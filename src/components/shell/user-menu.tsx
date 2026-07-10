"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChangePasswordDialog } from "@/components/shell/change-password-dialog";

type UserMenuProps = {
  name: string;
  email: string;
};

export function UserMenu({ name, email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const t = useTranslations("common");

  const source = name || email;
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  function openDialog() {
    setOpen(false);
    setDialogOpen(true);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center rounded-full p-0.5 hover:bg-bg-surface-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name || email}
      >
        <Avatar initials={initials || "?"} size="md" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute end-0 top-full mt-2 w-56 bg-bg-surface border border-border rounded-xl shadow-lg z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm text-fg font-medium truncate">{name || email}</p>
              <p className="text-xs text-fg-muted truncate">{email}</p>
            </div>
            <div className="py-1">
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full text-start px-3 py-2 text-sm text-fg-secondary hover:text-fg hover:bg-bg-surface-2 rounded-lg transition-colors"
              >
                {t("settings")}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={openDialog}
                className="block w-full text-start px-3 py-2 text-sm text-fg-secondary hover:text-fg hover:bg-bg-surface-2 rounded-lg transition-colors"
              >
                {t("changePassword")}
              </button>
              <SignOutButton />
            </div>
          </div>
        </>
      )}

      <ChangePasswordDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
