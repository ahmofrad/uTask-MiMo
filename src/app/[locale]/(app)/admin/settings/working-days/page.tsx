"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";

type HolidayRow = { date: string; name: string };
type WorkingDayConfig = { weekendDays: number[]; holidays: HolidayRow[] };

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

  useEffect(() => {
    apiFetch("/api/v1/admin/settings/working-days")
      .then((r) => r.json())
      .then((j) => {
        const data = j.data as WorkingDayConfig | undefined;
        if (data) {
          setWeekendDays(data.weekendDays ?? []);
          setHolidays(data.holidays ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
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
              <div className="space-y-2">
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
