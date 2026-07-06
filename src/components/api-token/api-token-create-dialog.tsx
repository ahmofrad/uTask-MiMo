"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-fetch";

type ApiTokenCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (_token: string) => void;
};

export function ApiTokenCreateDialog({ open, onClose, onCreated }: ApiTokenCreateDialogProps) {
  const t = useTranslations("token");
  const tc = useTranslations("common");
  const [name, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/tokens", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (json.data?.token) {
        onCreated(json.data.token);
      }
      onClose();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("createTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg mb-1">{t("tokenName")}</label>
          <Input
            value={name}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("placeholder")}
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
          >
            {tc("cancel")}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-1.5 text-sm font-medium bg-accent text-fg-inverse rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("creating") : t("createToken")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
