import { useEffect, useState } from "react";

const GANTT_PREFS_KEY = "ganttPrefs:v1";
const ZOOM_OPTIONS = [36, 52, 72] as const;

type GanttPrefs = {
  dayWidth: number;
  depsOpen: boolean;
  criticalListOpen: boolean;
  showCritical: boolean;
};

const DEFAULT_PREFS: GanttPrefs = {
  dayWidth: 52,
  depsOpen: false,
  criticalListOpen: false,
  showCritical: true,
};

export function useGanttPreferences() {
  const [dayWidth, setDayWidth] = useState(DEFAULT_PREFS.dayWidth);
  const [depsOpen, setDepsOpen] = useState(DEFAULT_PREFS.depsOpen);
  const [criticalListOpen, setCriticalListOpen] = useState(DEFAULT_PREFS.criticalListOpen);
  const [showCritical, setShowCritical] = useState(DEFAULT_PREFS.showCritical);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GANTT_PREFS_KEY);
      if (!stored) return;
      const prefs = JSON.parse(stored) as Partial<GanttPrefs>;
      if (typeof prefs.dayWidth === "number" && ZOOM_OPTIONS.includes(prefs.dayWidth as 36 | 52 | 72)) {
        setDayWidth(prefs.dayWidth);
      }
      if (typeof prefs.depsOpen === "boolean") setDepsOpen(prefs.depsOpen);
      if (typeof prefs.criticalListOpen === "boolean") setCriticalListOpen(prefs.criticalListOpen);
      if (typeof prefs.showCritical === "boolean") setShowCritical(prefs.showCritical);
    } catch { /* ignore */ }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(GANTT_PREFS_KEY, JSON.stringify({ dayWidth, depsOpen, criticalListOpen, showCritical }));
    } catch { /* ignore */ }
  }, [dayWidth, depsOpen, criticalListOpen, showCritical]);

  return {
    dayWidth, setDayWidth,
    depsOpen, setDepsOpen,
    criticalListOpen, setCriticalListOpen,
    showCritical, setShowCritical,
  };
}
