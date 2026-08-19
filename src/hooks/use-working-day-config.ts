"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  DEFAULT_WORKING_DAYS,
  type WorkingDayConfig,
} from "@/lib/date/working-day-calendar";

let sharedPromise: Promise<WorkingDayConfig> | null = null;

/**
 * Loads the working-day calendar (weekend days + holidays) for calendar and
 * Gantt views. The fetch is shared across all consumers of the hook so a
 * single request serves the whole page, and falls back to the default
 * (every day working) when the request fails.
 */
export function useWorkingDayConfig(): WorkingDayConfig | null {
  const [config, setConfig] = useState<WorkingDayConfig | null>(null);

  useEffect(() => {
    let active = true;
    sharedPromise ??= apiFetch("/api/v1/working-days")
      .then((res) => (res.ok ? (res.json() as Promise<{ data: WorkingDayConfig }>) : null))
      .then((json) => json?.data ?? DEFAULT_WORKING_DAYS)
      .catch(() => DEFAULT_WORKING_DAYS);
    sharedPromise.then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return config;
}
