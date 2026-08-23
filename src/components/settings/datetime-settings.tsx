"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";

/** Curated IANA timezone list — covers the major regions without shipping the full ~600-entry database. */
const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Tehran",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kabul",
  "Asia/Baghdad",
  "Asia/Yerevan",
  "Asia/Baku",
  "Asia/Tbilisi",
  "Asia/Almaty",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/Athens",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Bogota",
  "America/Lima",
  "America/Argentina/Buenos_Aires",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
] as const;

type DatetimeSettingsProps = {
  timeZone: string | null;
  timeFormat: "H12" | "H24";
  dualCalendar: boolean;
};

export function DatetimeSettings({
  timeZone: initialTz,
  timeFormat: initialFormat,
  dualCalendar: initialDual,
}: DatetimeSettingsProps) {
  const t = useTranslations("settings.datetime");
  const tc = useTranslations("common");
  const { addToast } = useToast();

  // Keep the user's current zone visible even if it's not in the curated list.
  const combinedTimezones = Array.from(
    new Set([...(COMMON_TIMEZONES as readonly string[]), ...(initialTz ? [initialTz] : [])]),
  );
  const [timeZone, setTimeZone] = useState(initialTz ?? "UTC");
  const [timeFormat, setTimeFormat] = useState<"H12" | "H24">(initialFormat);
  const [dualCalendar, setDualCalendar] = useState(initialDual);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/users/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({ timeZone, timeFormat, dualCalendar }),
      });
      addToast({ message: res.ok ? t("saved") : t("saveFailed") });
    } catch {
      addToast({ message: t("saveFailed") });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="tz" className="block text-sm font-medium text-fg-secondary mb-1">
          {t("timeZoneLabel")}
        </label>
        <select
          id="tz"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary"
        >
          {combinedTimezones.map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
        <p className="text-xs text-fg-muted mt-1">{t("timeZoneHint")}</p>
      </div>

      <div>
        <label htmlFor="timeFormat" className="block text-sm font-medium text-fg-secondary mb-1">
          {t("timeFormatLabel")}
        </label>
        <select
          id="timeFormat"
          value={timeFormat}
          onChange={(e) => setTimeFormat(e.target.value as "H12" | "H24")}
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary"
        >
          <option value="H24">{t("format24")}</option>
          <option value="H12">{t("format12")}</option>
        </select>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-border-primary px-4 py-3 cursor-pointer">
        <span>
          <span className="block text-sm font-medium text-fg-secondary">{t("dualCalendarLabel")}</span>
          <span className="block text-xs text-fg-muted mt-0.5">{t("dualCalendarHint")}</span>
        </span>
        <input
          type="checkbox"
          checked={dualCalendar}
          onChange={(e) => setDualCalendar(e.target.checked)}
          className="accent-accent w-4 h-4"
        />
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? tc("loading") : tc("save")}
      </button>
    </div>
  );
}