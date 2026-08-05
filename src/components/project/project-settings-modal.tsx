"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";

type ProjectSettingsValues = {
  status: "active" | "archived";
  visibility: string;
  color: string;
};

type ProjectSettingsModalProps = {
  open: boolean;
  initial: ProjectSettingsValues;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (_values: ProjectSettingsValues) => Promise<void>;
};

export function ProjectSettingsModal({
  open,
  initial,
  saving,
  error,
  onClose,
  onSave,
}: ProjectSettingsModalProps) {
  const t = useTranslations("project");
  const [status, setStatus] = useState<"active" | "archived">(initial.status);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [color, setColor] = useState(initial.color);

  useEffect(() => {
    if (open) {
      setStatus(initial.status);
      setVisibility(initial.visibility);
      setColor(initial.color);
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title={t("settings.title")}>
      <div className="space-y-4">
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("fields.status")}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "archived")}
              className="w-full bg-bg-secondary rounded px-3 py-2 text-sm outline-none border border-border text-fg-primary"
            >
              <option value="active">{t("statusActive")}</option>
              <option value="archived">{t("statusArchived")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("fields.visibility")}</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full bg-bg-secondary rounded px-3 py-2 text-sm outline-none border border-border text-fg-primary"
            >
              <option value="private">{t("visibilityOptions.private")}</option>
              <option value="department">{t("visibilityOptions.department")}</option>
              <option value="org">{t("visibilityOptions.org")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("fields.color")}</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-10 bg-bg-secondary rounded border border-border cursor-pointer"
            />
          </div>
          {error && (
            <p className="text-sm text-fg-inverse bg-destructive px-3 py-2 rounded-md" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void onSave({ status, visibility, color })}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
      </div>
    </Dialog>
  );
}
