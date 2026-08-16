"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";

type ProfileProps = {
  userId: string;
  name: string | null | undefined;
  email: string | null | undefined;
};

export function ProfileSettings({ userId, name, email }: ProfileProps) {
  const tc = useTranslations("common");
  const { addToast } = useToast();
  const [displayName, setDisplayName] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (res.ok) {
        addToast({ message: tc("save") + "!" });
      } else {
        addToast({ message: tc("error") });
      }
    } catch {
      addToast({ message: tc("error") });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-fg-secondary mb-1">{tc("displayName")}</label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg-secondary mb-1">{tc("emailLabel")}</label>
        <input
          id="email"
          type="email"
          value={email ?? ""}
          readOnly
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-surface text-fg-muted"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving || displayName === name}
        className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? tc("loading") : tc("save")}
      </button>
    </div>
  );
}
