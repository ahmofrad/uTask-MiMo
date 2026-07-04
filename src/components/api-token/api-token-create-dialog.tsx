"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ApiTokenCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (_token: string) => void;
};

export function ApiTokenCreateDialog({ open, onClose, onCreated }: ApiTokenCreateDialogProps) {
  const [name, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <Dialog open={open} onClose={onClose} title="Create API Token">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Token Name</label>
          <Input
            value={name}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. CI/CD Integration"
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-1.5 text-sm font-medium bg-accent text-fg-inverse rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Token"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
