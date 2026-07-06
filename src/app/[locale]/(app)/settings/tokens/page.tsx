"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";

export default function TokensPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { shortDate } = useFormattedDate();
  const [tokens, setTokens] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenRaw, setNewTokenRaw] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/v1/tokens")
      .then((r) => r.json())
      .then((j) => setTokens(j.data ?? []))
      .catch(() => {});
  }, []);

  async function createToken() {
    if (!newTokenName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/v1/tokens", {
        method: "POST",
        body: JSON.stringify({ name: newTokenName.trim(), scopes: ["tasks:read", "tasks:write"] }),
      });
      const j = await res.json();
      if (j.data?.raw) {
        setNewTokenRaw(j.data.raw);
        setTokens((prev) => [{ id: j.data.id, name: j.data.name, prefix: j.data.prefix, scopes: j.data.scopes, revokedAt: null, createdAt: new Date().toISOString() }, ...prev]);
      }
      setNewTokenName("");
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(id: string) {
    await apiFetch(`/api/v1/tokens/${id}`, { method: "DELETE" });
    setTokens((prev) => prev.map((tk) => tk.id === id ? { ...tk, revokedAt: new Date().toISOString() } : tk));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("tokens")}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          + {t("newToken")}
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreate(false); setNewTokenRaw(null); }} />
          <div className="relative bg-bg-primary border border-border-primary rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            {newTokenRaw ? (
              <>
                <h2 className="text-lg font-semibold text-fg-primary">{t("tokenCreated")}</h2>
                <p className="text-sm text-fg-muted">{t("tokenCopyWarning")}</p>
                <div className="p-3 bg-bg-secondary rounded-lg font-mono text-xs text-fg-primary break-all">{newTokenRaw}</div>
                <button
                  onClick={() => { setShowCreate(false); setNewTokenRaw(null); }}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
                >
                  {tc("close")}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-fg-primary">{tc("create")}</h2>
                <input
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder={t("tokenName")}
                  className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowCreate(false); setNewTokenName(""); }}
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
                  >
                    {tc("cancel")}
                  </button>
                  <button
                    onClick={createToken}
                    disabled={creating || !newTokenName.trim()}
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {creating ? t("creating") : tc("create")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        {tokens.map((token) => (
          <div key={token.id} className="flex items-center gap-4 p-4 bg-bg-primary border border-border-secondary rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fg-primary">{token.name}</span>
                <span className="text-xs font-mono text-fg-muted">{token.prefix}...</span>
                {token.revokedAt && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-danger-bg text-danger">{t("revoked")}</span>
                )}
                {token.expiresAt && token.expiresAt < new Date() && !token.revokedAt && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-warning-bg text-warning">{t("expired")}</span>
                )}
              </div>
              <div className="text-xs text-fg-muted mt-1">
                {t("created")} {shortDate(token.createdAt)}
                {token.lastUsedAt && ` · ${t("lastUsed")} ${shortDate(token.lastUsedAt)}`}
              </div>
            </div>
            {!token.revokedAt && (
              <button
                onClick={() => revokeToken(token.id)}
                className="text-xs text-destructive hover:underline"
              >
                {tc("delete")}
              </button>
            )}
          </div>
        ))}
        {tokens.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">{t("noTokens")}</p>
        )}
      </div>
    </div>
  );
}
