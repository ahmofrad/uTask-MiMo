"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Menu } from "@/components/ui/menu";
import { ChangePasswordDialog } from "@/components/shell/change-password-dialog";
import { getLogoutRedirectUrl } from "@/lib/auth/logout-redirect";

type UserMenuProps = {
  name: string;
  email: string;
};

export function UserMenu({ name, email }: UserMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("common");

  const source = name || email;
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  async function handleSignOut() {
    await signOut({ redirect: false });
    window.location.assign(getLogoutRedirectUrl(window.location.origin));
  }

  return (
    <>
      <Menu
        label={t("accountMenu")}
        triggerAriaLabel={name || email}
        triggerClassName="rounded-full p-0.5 hover:bg-bg-surface-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
        header={
          <>
            <p className="text-sm text-fg font-medium truncate">{name || email}</p>
            <p className="text-xs text-fg-muted truncate">{email}</p>
          </>
        }
        items={[
          {
            id: "settings",
            label: t("settings"),
            onSelect: () => router.push("/settings"),
          },
          {
            id: "change-password",
            label: t("changePassword"),
            onSelect: () => setDialogOpen(true),
          },
          {
            id: "sign-out",
            label: t("signOut"),
            onSelect: handleSignOut,
          },
        ]}
      >
        <Avatar initials={initials || "?"} size="md" />
      </Menu>

      <ChangePasswordDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
