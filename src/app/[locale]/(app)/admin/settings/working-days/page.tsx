"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { SUPPORTED_HOLIDAY_COUNTRIES } from "@/lib/date/holidays/countries";

type HolidayRow = { date: string; name: string };
type WorkingDayConfig = { weekendDays: number[]; holidays: HolidayRow[] };
type EgressConfig = { enabled: boolean; baseUrl: string; countryCode: string };

const WEEKDAY_KEYS = [
  "daySun",
  "dayMon",
  "dayTue",
  "dayWed",
  "dayThu",
  "dayFri",
  "daySat",
] as const;

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent";

export default function WorkingDaysPage() {
  const t = useTranslations("workingDays");
  const tCommon = useTranslations("common");

  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Import state.
  const [region, setRegion] = useState<"ir" | "us">("ir");
  const [yearFrom, setYearFrom] = useState(() => new Date().getFullYear());
  const [yearTo, setYearTo] = useState(() => new Date().getFullYear() + 1);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Egress download state.
  const [egress, setEgress] = useState<EgressConfig>({
    enabled: false,
    baseUrl: "https://date.nager.at",
    countryCode: "US",
  });
  const [egressLoaded, setEgressLoaded] = useState(false);
  const [savingEgress, setSavingEgress] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadYear, setDownloadYear] = useState(() => new Date().getFullYear());

  async function refresh() {
    const res = await apiFetch("/api/v1/admin/settings/working-days");
    const data = (await res.json()) as { data?: WorkingDayConfig };
    if (data.data) {
      setWeekendDays(data.data.weekendDays ?? []);
      setHolidays(data.data.holidays ?? []);
    }
  }

  useEffect(() => {
    void refresh()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

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

  function toggleWeekend(day: number) {
    setWeekendDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function updateHoliday(index: number, patch: Partial<HolidayRow>) {
    setHolidays((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/working-days", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekendDays,
          // A holiday must have a date; the name is optional.
          holidays: holidays.filter((h) => h.date.trim() !== ""),
        }),
      });
      setMsg(res.ok ? { ok: true, text: t("saved") } : { ok: false, text: t("saveFailed") });
    } catch {
      setMsg({ ok: false, text: t("networkError") });
    }
    setSaving(false);
  }

  async function importOfficial() {
    setImporting(true);
    setImportMsg(null);
    const years: number[] = [];
    for (let year = Math.min(yearFrom, yearTo); year <= Math.max(yearFrom, yearTo); year++) {
      years.push(year);
    }
    try {
      const res = await apiFetch("/api/v1/admin/settings/working-days/import-official", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, years }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          data?: { imported: number; skipped: number };
        };
        setImportMsg({
          ok: true,
          text: t("importResult", {
            imported: body.data?.imported ?? 0,
            skipped: body.data?.skipped ?? 0,
          }),
        });
        await refresh();
      } else {
        setImportMsg({ ok: false, text: t("importFailed") });
      }
    } catch {
      setImportMsg({ ok: false, text: t("networkError") });
    }
    setImporting(false);
  }

  async function importCsv() {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/working-days/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const body = (await res.json()) as {
        data?: { imported: number; skipped: number; errors: string[] };
      };
      if (res.ok) {
        const errors = body.data?.errors?.length ?? 0;
        setImportMsg({
          ok: errors === 0,
          text: errors === 0
            ? t("importResult", { imported: body.data?.imported ?? 0, skipped: body.data?.skipped ?? 0 })
            : t("csvPartialError", { count: errors }),
        });
        setCsvText("");
        await refresh();
      } else {
        setImportMsg({ ok: false, text: t("importFailed") });
      }
    } catch {
      setImportMsg({ ok: false, text: t("networkError") });
    }
    setImporting(false);
  }

  async function saveEgress() {
    setSavingEgress(true);
    setImportMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/working-days/egress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(egress),
      });
      setImportMsg(res.ok ? { ok: true, text: t("egressSaved") } : { ok: false, text: t("egressSaveFailed") });
      if (res.ok) {
        const body = (await res.json()) as { data?: EgressConfig };
        if (body.data) setEgress(body.data);
      }
    } catch {
      setImportMsg({ ok: false, text: t("networkError") });
    }
    setSavingEgress(false);
  }

  async function downloadHolidays() {
    setDownloading(true);
    setImportMsg(null);
    try {
      const res = await apiFetch("/api/v1/admin/settings/working-days/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: downloadYear }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          data?: { imported: number; skipped: number };
        };
        setImportMsg({
          ok: true,
          text: t("downloadResult", {
            imported: body.data?.imported ?? 0,
            skipped: body.data?.skipped ?? 0,
          }),
        });
        await refresh();
      } else {
        const body = (await res.json()) as { error?: { code?: string } };
        setImportMsg({
          ok: false,
          text: body.error?.code === "egress_disabled" ? t("egressDisabled") : t("downloadFailed"),
        });
      }
    } catch {
      setImportMsg({ ok: false, text: t("networkError") });
    }
    setDownloading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
      <p className="text-sm text-fg-tertiary max-w-2xl">{t("description")}</p>

      {!loaded ? (
        <p className="text-sm text-fg-tertiary">{t("loading")}</p>
      ) : (
        <div className="max-w-2xl space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-fg-primary">{t("weekendTitle")}</h2>
            <p className="text-sm text-fg-tertiary">{t("weekendHint")}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("weekendTitle")}>
              {WEEKDAY_KEYS.map((key, day) => {
                const selected = weekendDays.includes(day);
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid={`wd-weekend-${day}`}
                    aria-pressed={selected}
                    onClick={() => toggleWeekend(day)}
                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      selected
                        ? "bg-accent text-fg-inverse border-accent"
                        : "bg-bg-primary text-fg-secondary border-border-primary hover:bg-bg-surface-2"
                    }`}
                  >
                    {t(key)}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-fg-primary">{t("holidayTitle")}</h2>
              <button
                type="button"
                data-testid="wd-add-holiday"
                onClick={() => setHolidays((prev) => [...prev, { date: "", name: "" }])}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("addHoliday")}
              </button>
            </div>
            <p className="text-sm text-fg-tertiary">{t("holidayHint")}</p>

            {holidays.length === 0 ? (
              <p data-testid="wd-no-holidays" className="text-sm text-fg-tertiary bg-bg-surface border border-border-primary rounded-lg px-4 py-3">
                {t("noHolidays")}
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                {holidays.map((holiday, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <JalaliDatePicker
                      value={holiday.date || null}
                      onChange={(value) => updateHoliday(index, { date: value ?? "" })}
                      testId={`wd-holiday-date-${index}`}
                      className="w-44"
                    />
                    <input
                      type="text"
                      data-testid={`wd-holiday-name-${index}`}
                      value={holiday.name}
                      onChange={(e) => updateHoliday(index, { name: e.target.value })}
                      placeholder={t("holidayNamePlaceholder")}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      data-testid={`wd-holiday-remove-${index}`}
                      onClick={() => setHolidays((prev) => prev.filter((_, i) => i !== index))}
                      className="p-2 rounded-md text-fg-muted hover:text-destructive hover:bg-bg-surface-2"
                      aria-label={tCommon("delete")}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

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

            <div className="space-y-3 bg-bg-surface border border-border-primary rounded-lg p-4">
              <h3 className="text-sm font-semibold text-fg-primary">{t("egressTitle")}</h3>
              <p className="text-xs text-fg-tertiary">{t("egressHint")}</p>
              <p className="text-xs text-fg-tertiary">{t("egressCountryNote")}</p>
              {!egressLoaded ? (
                <p className="text-xs text-fg-tertiary">{t("loading")}</p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-fg-primary">
                    <input
                      type="checkbox"
                      data-testid="wd-egress-enabled"
                      checked={egress.enabled}
                      onChange={(e) => setEgress((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="w-4 h-4 accent-accent"
                    />
                    {t("egressEnabled")}
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                    {t("egressCountry")}
                    <select
                      data-testid="wd-egress-country"
                      value={egress.countryCode}
                      onChange={(e) => setEgress((prev) => ({ ...prev, countryCode: e.target.value }))}
                      className={inputClass}
                    >
                      {SUPPORTED_HOLIDAY_COUNTRIES.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name} ({code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    data-testid="wd-egress-save"
                    onClick={() => void saveEgress()}
                    disabled={savingEgress}
                    className="px-4 py-2 bg-bg-primary text-fg-primary border border-border-primary rounded-md text-sm font-medium hover:bg-bg-surface-2 disabled:opacity-50"
                  >
                    {t("egressSaveBtn")}
                  </button>
                  <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                    {t("importFrom")}
                    <input
                      type="number"
                      data-testid="wd-egress-year"
                      value={downloadYear}
                      onChange={(e) => setDownloadYear(Number(e.target.value))}
                      className={`${inputClass} w-24`}
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="wd-egress-download"
                    onClick={() => void downloadHolidays()}
                    disabled={downloading || !egress.enabled}
                    className="px-4 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {downloading ? t("egressDownloading") : t("egressDownloadBtn")}
                  </button>
                </div>
              )}
            </div>

            {importMsg && (
              <p
                data-testid="wd-import-msg"
                className={`text-sm ${importMsg.ok ? "text-success" : "text-destructive"}`}
              >
                {importMsg.text}
              </p>
            )}
          </section>

          <div className="flex items-center gap-4">
            <button
              type="button"
              data-testid="wd-save"
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t("saving") : tCommon("save")}
            </button>
            {msg && (
              <p data-testid="wd-msg" className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
