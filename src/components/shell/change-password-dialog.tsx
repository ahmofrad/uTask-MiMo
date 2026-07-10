"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
};

const ERROR_KEYS: Record<string, string> = {
  INVALID_CURRENT_PASSWORD: "invalidCurrentPassword",
  NO_LOCAL_PASSWORD: "noLocalPassword",
  passwordTooShort: "passwordTooShort",
  passwordMismatch: "passwordMismatch",
  UNAUTHORIZED: "sessionExpired",
  UNKNOWN: "error",
};

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const t = useTranslations("common");
  const { addToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSubmitting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = json?.error?.code ?? "UNKNOWN";
        setError(t(ERROR_KEYS[code] ?? "error"));
        setSubmitting(false);
        return;
      }
      addToast({ message: t("passwordChanged") });
      close();
    } catch {
      setError(t("error"));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title={t("changePassword")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">{t("currentPassword")}</label>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">{t("newPassword")}</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">{t("confirmPassword")}</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
