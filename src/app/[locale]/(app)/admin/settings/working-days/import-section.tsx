"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { EgressConfigSection, type EgressConfig } from "./egress-config";

const inputClass =
  "px-3 py-2 rounded-md border border-border-primary bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

type ImportSectionProps = {
  onImported: () => void;
};

export function WorkingDaysImportSection({ onImported }: ImportSectionProps) {
  const t = useTranslations("workingDays");
  const [region, setRegion] = useState<"ir" | "us">("ir");
  const [yearFrom, setYearFrom] = useState(() => new Date().getFullYear());
  const [yearTo, setYearTo] = useState(() => new Date().getFullYear() + 1);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [egress, setEgress] = useState<EgressConfig>({
    enabled: false,
    provider: "nager",
    countryCode: "US",
    baseUrl: "https://date.nager.at",
    apiKey: "",
    keyState: "ok",
  });
  const [egressLoaded, setEgressLoaded] = useState(false);
  const [savingEgress, setSavingEgress] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadYear, setDownloadYear] = useState(() => new Date().getFullYear());
  const [onlyDayOffs, setOnlyDayOffs] = useState(true);

  useEffect(() => {
    apiFetch("/api/v1/admin/settings/working-days/egress")
      .then((r) => r.json())
      .then((j) => {
        const data = j.data as EgressConfig | undefined;
        if (data) setEgress(data);
      })
      .catch(() => {})
      .finally(() => setEgressLoaded(true));
  }, []);

  async function importOfficial() {
    setImporting(true);
    setImportMsg(null);
    try {
      const years: number[] = [];
      for (let y = yearFrom; y <= yearTo; y++) years.push(y);
      const res = await apiFetch("/api/v1/admin/settings/working-days/import-official", {
        method: "POST",
        body: JSON.stringify({ region, years }),
      });
      const body = (await res.json()) as {
        data?: { imported?: number; skipped?: number; errors?: { row?: number; message?: string }[] };
      };
      const imported = body.data?.imported ?? 0;
      const skipped = body.data?.skipped ?? 0;
      const errors = body.data?.errors?.length ?? 0;
      if (!res.ok) {
        setImportMsg({ ok: false, text: t("importFailed") });
      } else if (errors > 0) {
        setImportMsg({ ok: false, text: t("importPartial", { imported, skipped, errors }) });
      } else {
        setImportMsg({ ok: true, text: t("importDone", { imported, skipped }) });
      }
      onImported();
    } catch {
      setImportMsg({ ok: false, text: t("importFailed") });
    } finally {
      setImporting(false);
    }
  }

  async function importCsv() {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/working-days/import-csv", {
        method: "POST",
        body: JSON.stringify({ csv: csvText }),
      });
      const body = (await res.json()) as {
        data?: { imported?: number; errors?: { row?: number; message?: string }[] };
      };
      const imported = body.data?.imported ?? 0;
      const errors = body.data?.errors?.length ?? 0;
      if (!res.ok) {
        setImportMsg({ ok: false, text: t("csvImportFailed") });
      } else if (errors > 0) {
        setImportMsg({ ok: false, text: t("csvImportPartial", { imported, errors }) });
      } else {
        setImportMsg({ ok: true, text: t("csvImportDone", { imported }) });
      }
      onImported();
    } catch {
      setImportMsg({ ok: false, text: t("csvImportFailed") });
    } finally {
      setImporting(false);
    }
  }

  async function saveEgress() {
    setSavingEgress(true);
    try {
      const egressBody = {
        enabled: egress.enabled,
        provider: egress.provider,
        countryCode: egress.countryCode,
        baseUrl: egress.baseUrl,
        apiKey: egress.apiKey,
      };
      const res = await apiFetch("/api/v1/admin/settings/working-days/egress", {
        method: "PUT",
        body: JSON.stringify(egressBody),
      });
      const body = (await res.json()) as { data?: EgressConfig };
      if (body.data) setEgress(body.data);
      setImportMsg({ ok: res.ok, text: res.ok ? t("egressSaved") : t("egressSaveFailed") });
    } catch {
      setImportMsg({ ok: false, text: t("egressSaveFailed") });
    } finally {
      setSavingEgress(false);
    }
  }

  async function downloadHolidays() {
    setDownloading(true);
    setImportMsg(null);
    try {
      const params = new URLSearchParams({ year: String(downloadYear), onlyDayOffs: String(onlyDayOffs) });
      const res = await apiFetch(
        `/api/v1/admin/settings/working-days/download?${params}`,
      );
      const body = (await res.json()) as { data?: { count?: number; rows?: string[] } };
      if (!res.ok) {
        setImportMsg({ ok: false, text: t("downloadFailed") });
        return;
      }
      const count = body.data?.count ?? 0;
      setImportMsg({ ok: true, text: t("downloadDone", { count }) });
      onImported();
    } catch {
      const body = (await apiFetch(`/api/v1/admin/settings/working-days/download?year=${downloadYear}`).then((r) => r.json()).catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      const reason = body?.error?.message;
      setImportMsg({ ok: false, text: reason ? t("downloadFailedReason", { reason }) : t("downloadFailed") });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section data-testid="wd-import-section" className="space-y-3 border-t border-border-primary pt-6">
      <h2 className="text-lg font-semibold text-fg-primary">{t("importTitle")}</h2>
      <p className="text-sm text-fg-tertiary">{t("importHint")}</p>

      <div className="space-y-3 bg-bg-surface border border-border-primary rounded-lg p-4">
        <h3 className="text-sm font-semibold text-fg-primary">{t("importOfficialTitle")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">
            {t("importRegion")}
            <select
              data-testid="wd-import-region"
              value={region}
              onChange={(e) => setRegion(e.target.value as "ir" | "us")}
              className={inputClass}
            >
              <option value="ir">{t("regionIr")}</option>
              <option value="us">{t("regionUs")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">
            {t("importFrom")}
            <input
              type="number"
              data-testid="wd-import-year-from"
              value={yearFrom}
              onChange={(e) => setYearFrom(Number(e.target.value))}
              className={`${inputClass} w-24`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">
            {t("importTo")}
            <input
              type="number"
              data-testid="wd-import-year-to"
              value={yearTo}
              onChange={(e) => setYearTo(Number(e.target.value))}
              className={`${inputClass} w-24`}
            />
          </label>
          <button
            type="button"
            data-testid="wd-import-official-btn"
            onClick={() => void importOfficial()}
            disabled={importing}
            className="px-4 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {importing ? t("importing") : t("importBtn")}
          </button>
        </div>
      </div>

      <div className="space-y-3 bg-bg-surface border border-border-primary rounded-lg p-4">
        <h3 className="text-sm font-semibold text-fg-primary">{t("csvTitle")}</h3>
        <p className="text-xs text-fg-tertiary">{t("csvHint")}</p>
        <textarea
          data-testid="wd-import-csv-text"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={t("csvPlaceholder")}
          rows={4}
          className={`${inputClass} font-mono text-xs`}
        />
        <button
          type="button"
          data-testid="wd-import-csv-btn"
          onClick={() => void importCsv()}
          disabled={importing || csvText.trim() === ""}
          className="px-4 py-2 bg-bg-primary text-fg-primary border border-border-primary rounded-md text-sm font-medium hover:bg-bg-surface-2 disabled:opacity-50"
        >
          {importing ? t("importing") : t("csvImportBtn")}
        </button>
      </div>

      <EgressConfigSection
        egress={egress}
        loaded={egressLoaded}
        saving={savingEgress}
        downloading={downloading}
        downloadYear={downloadYear}
        onlyDayOffs={onlyDayOffs}
        onEgressChange={setEgress}
        onYearChange={setDownloadYear}
        onOnlyDayOffsChange={setOnlyDayOffs}
        onSave={() => void saveEgress()}
        onDownload={() => void downloadHolidays()}
      />

      {importMsg && (
        <p data-testid="wd-import-msg" className={`text-sm ${importMsg.ok ? "text-success" : "text-destructive"}`}>
          {importMsg.text}
        </p>
      )}
    </section>
  );
}