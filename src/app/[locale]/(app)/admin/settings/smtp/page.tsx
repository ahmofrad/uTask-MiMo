"use client";

import { useState, useEffect } from "react";

export default function SmtpConfigPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/settings/smtp")
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(j.data as Record<string, unknown>)) {
          map[k] = String(v ?? "");
        }
        setValues(map);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/v1/admin/settings/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        setMsg("Saved successfully. Restart required for SMTP changes to take effect.");
      } else {
        setMsg("Failed to save.");
      }
    } catch {
      setMsg("Network error.");
    }
    setSaving(false);
  }

  const fields = [
    { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.example.com" },
    { key: "smtp_port", label: "SMTP Port", placeholder: "587" },
    { key: "smtp_user", label: "Username" },
    { key: "smtp_pass", label: "Password", type: "password" },
    { key: "smtp_from", label: "From Address", placeholder: "noreply@utask.local" },
    { key: "smtp_secure", label: "Use TLS (true/false)", placeholder: "false" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">SMTP Configuration</h1>
      <p className="text-sm text-fg-tertiary">
        Configure outbound email. Changes require a server restart.
      </p>

      <div className="max-w-md space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-fg-secondary mb-1">{f.label}</label>
            <input
              type={f.type ?? "text"}
              value={values[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm"
            />
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {msg && <p className="text-sm text-fg-tertiary">{msg}</p>}
    </div>
  );
}
