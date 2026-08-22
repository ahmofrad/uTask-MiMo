"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { countriesForProvider, type HolidayProvider, PROVIDER_DEFAULT_BASE_URLS } from "@/lib/date/holidays/countries";

const EGRESS_API_KEY_MASK = "********";

const inputClass =
  "px-3 py-2 rounded-md border border-border-primary bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

export type EgressConfig = {
  enabled: boolean;
  provider: HolidayProvider;
  countryCode: string;
  baseUrl: string;
  apiKey: string;
  keyState: "ok" | "broken";
};

type Props = {
  egress: EgressConfig;
  loaded: boolean;
  saving: boolean;
  downloading: boolean;
  downloadYear: number;
  onlyDayOffs: boolean;
  onEgressChange: (_config: EgressConfig) => void;
  onYearChange: (_year: number) => void;
  onOnlyDayOffsChange: (_value: boolean) => void;
  onSave: () => void;
  onDownload: () => void;
};

export const EgressConfigSection = memo(function EgressConfigSection({
  egress,
  loaded,
  saving,
  downloading,
  downloadYear,
  onlyDayOffs,
  onEgressChange,
  onYearChange,
  onOnlyDayOffsChange,
  onSave,
  onDownload,
}: Props) {
  const t = useTranslations("workingDays");

  return (
    <div className="space-y-3 bg-bg-surface border border-border-primary rounded-lg p-4">
      <h3 className="text-sm font-semibold text-fg-primary">{t("egressTitle")}</h3>
      <p className="text-xs text-fg-tertiary">{t("egressHint")}</p>
      {!loaded ? (
        <p className="text-xs text-fg-tertiary">{t("loading")}</p>
      ) : (
        <div className="space-y-3">
          {egress.keyState === "broken" && (
            <p
              data-testid="wd-egress-key-broken"
              className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
            >
              {t("egressKeyBroken")}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-fg-primary">
              <input
                type="checkbox"
                data-testid="wd-egress-enabled"
                checked={egress.enabled}
                onChange={(e) => onEgressChange({ ...egress, enabled: e.target.checked })}
                className="w-4 h-4 accent-accent"
              />
              {t("egressEnabled")}
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-secondary">
              {t("egressProvider")}
              <select
                data-testid="wd-egress-provider"
                value={egress.provider}
                onChange={(e) => {
                  const provider = e.target.value as HolidayProvider;
                  const available = countriesForProvider(provider);
                  const stillSupported = available.some(([code]) => code === egress.countryCode);
                  onEgressChange({
                    ...egress,
                    provider,
                    baseUrl: PROVIDER_DEFAULT_BASE_URLS[provider],
                    countryCode: stillSupported ? egress.countryCode : "US",
                  });
                }}
                className={inputClass}
              >
                <option value="nager">{t("providerNager")}</option>
                <option value="calendarific">{t("providerCalendarific")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-secondary">
              {t("egressCountry")}
              <select
                data-testid="wd-egress-country"
                value={egress.countryCode}
                onChange={(e) => onEgressChange({ ...egress, countryCode: e.target.value })}
                className={inputClass}
              >
                {countriesForProvider(egress.provider).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name} ({code})
                  </option>
                ))}
              </select>
            </label>
            {egress.provider === "calendarific" && (
              <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                {t("egressApiKey")}
                <input
                  type="password"
                  data-testid="wd-egress-api-key"
                  value={egress.apiKey === EGRESS_API_KEY_MASK ? "" : egress.apiKey}
                  placeholder={egress.apiKey === EGRESS_API_KEY_MASK ? EGRESS_API_KEY_MASK : ""}
                  onChange={(e) => onEgressChange({ ...egress, apiKey: e.target.value })}
                  autoComplete="off"
                  className={`${inputClass} w-56`}
                />
              </label>
            )}
            <button
              type="button"
              data-testid="wd-egress-save"
              onClick={onSave}
              disabled={saving}
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
                onChange={(e) => onYearChange(Number(e.target.value))}
                className={`${inputClass} w-24`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-primary">
              <input
                type="checkbox"
                data-testid="wd-egress-only-dayoffs"
                checked={onlyDayOffs}
                onChange={(e) => onOnlyDayOffsChange(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              {t("onlyDayOffs")}
            </label>
            <button
              type="button"
              data-testid="wd-egress-download"
              onClick={onDownload}
              disabled={downloading || !egress.enabled}
              className="px-4 py-2 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {downloading ? t("egressDownloading") : t("egressDownloadBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});