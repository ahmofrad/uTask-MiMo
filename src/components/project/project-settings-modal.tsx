"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

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
  projectId: string;
};

export function ProjectSettingsModal({
  open,
  initial,
  saving,
  error,
  onClose,
  onSave,
  projectId,
}: ProjectSettingsModalProps) {
  const router = useRouter();
  const t = useTranslations("project");
  const [status, setStatus] = useState<"active" | "archived">(initial.status);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [color, setColor] = useState(initial.color);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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

          {/* Danger Zone */}
          <div className="border-t border-border-primary pt-4 mt-4">
            <h3 className="text-sm font-medium text-destructive mb-1">{t("settings.dangerZone")}</h3>
            <p className="text-xs text-fg-muted mb-3">
              {t("settings.dangerZoneDesc")}
            </p>
            {confirmingArchive ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive">{t("settings.confirmArchive")}</p>
                {archiveError && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md" role="alert">
                    {archiveError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setArchiving(true);
                      setArchiveError(null);
                      try {
                        const res = await apiFetch(`/api/v1/projects/${projectId}`, { method: "DELETE" });
                        if (!res.ok) {
                          const body = await res.json().catch(() => null);
                          throw new Error(body?.error?.message ?? t("settings.archiveFailed"));
                        }
                        router.push("/projects");
                      } catch (err) {
                        setArchiveError(err instanceof Error ? err.message : t("settings.archiveFailed"));
                      } finally {
                        setArchiving(false);
                      }
                    }}
                    disabled={archiving}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-danger text-destructive hover:bg-danger-bg transition-colors disabled:opacity-50"
                  >
                    {archiving ? t("saving") : t("settings.archiveButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingArchive(false)}
                    disabled={archiving}
                    className="px-4 py-2 text-sm rounded-md text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingArchive(true)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-danger text-destructive hover:bg-danger-bg transition-colors"
              >
                {t("settings.archiveButton")}
              </button>
            )}
          </div>
      </div>
    </Dialog>
  );
}
