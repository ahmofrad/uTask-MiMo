"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { toJalali, toGregorian, getDaysInMonth, getMonthName, getDayName } from "@/lib/date/jalali";
import { cn } from "@/lib/cn";

type JalaliDatePickerProps = {
  value: string | null;
  onChange: (_value: string | null) => void;
  placeholder?: string;
  className?: string;
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function JalaliDatePicker({ value, onChange, placeholder, className }: JalaliDatePickerProps) {
  const locale = useLocale() as "fa-IR" | "en-US";
  const t = useTranslations();
  const { shortDate } = useFormattedDate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [viewDate, setViewDate] = useState(() => {
    if (value) return toJalali(new Date(value));
    const now = toJalali(new Date());
    return { jy: now.jy, jm: now.jm, jd: now.jd };
  });

  useEffect(() => {
    if (value) setViewDate(toJalali(new Date(value)));
  }, [value]);

  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      if (spaceBelow < dropdownHeight) {
        setPos({ top: rect.top - dropdownHeight - 4, left: rect.left });
      } else {
        setPos({ top: rect.bottom + 4, left: rect.left });
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      const handleClickOutside = (e: MouseEvent) => {
        if (dropRef.current && !dropRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          btnRef.current?.focus();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
      const focusIndex = (() => {
        if (value) {
          const sel = toJalali(new Date(value));
          if (sel.jy === viewDate.jy && sel.jm === viewDate.jm) return sel.jd - 1;
        }
        if (isTodayDay()) {
          return todayRefDay() - 1;
        }
        return 0;
      })();
      setTimeout(() => dayRefs.current[focusIndex]?.focus(), 0);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKey);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, updatePosition]);

  const daysInMonth = getDaysInMonth(viewDate.jy, viewDate.jm);
  const firstDayDate = toGregorian(viewDate.jy, viewDate.jm, 1);
  const startOffset = (firstDayDate.getDay() + 1) % 7;
  const today = toJalali(new Date());
  const isTodayDay = () => viewDate.jy === today.jy && viewDate.jm === today.jm;
  const todayRefDay = () => today.jd;
  const isToday = (day: number) => isTodayDay() && day === today.jd;
  const isSelected = (day: number) => {
    if (!value) return false;
    const sel = toJalali(new Date(value));
    return viewDate.jy === sel.jy && viewDate.jm === sel.jm && day === sel.jd;
  };

  function prevMonth() {
    setViewDate(viewDate.jm === 1 ? { jy: viewDate.jy - 1, jm: 12, jd: 1 } : { jy: viewDate.jy, jm: viewDate.jm - 1, jd: 1 });
  }

  function nextMonth() {
    setViewDate(viewDate.jm === 12 ? { jy: viewDate.jy + 1, jm: 1, jd: 1 } : { jy: viewDate.jy, jm: viewDate.jm + 1, jd: 1 });
  }

  function selectDay(day: number) {
    const date = toGregorian(viewDate.jy, viewDate.jm, day);
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
    setOpen(false);
    btnRef.current?.focus();
  }

  const displayValue = value ? shortDate(new Date(value)) : "";

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-start focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span className={cn(!value && "text-fg-subtle")}>{displayValue || placeholder || t("task.selectDate")}</span>
        <svg className="w-4 h-4 text-fg-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div
          ref={dropRef}
          role="dialog"
          aria-modal="false"
          aria-label={t("task.selectDate")}
          className="fixed w-80 max-h-[80vh] overflow-y-auto bg-bg-primary border border-border-primary rounded-xl shadow-xl z-[100] p-3"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              aria-label={t("task.prevMonth")}
              className="p-1 hover:bg-bg-surface rounded-md"
            >
              <svg className="w-4 h-4 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-fg-primary">{getMonthName(viewDate.jm, locale)} {viewDate.jy}</span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label={t("task.nextMonth")}
              className="p-1 hover:bg-bg-surface rounded-md"
            >
              <svg className="w-4 h-4 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1" role="row">
            {WEEKDAYS.map((d) => (
              <div key={d} role="columnheader" className="text-center text-xs text-fg-muted py-1">{getDayName(d, locale)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              return (
                <button
                  key={day}
                  ref={(el) => { dayRefs.current[i] = el; }}
                  type="button"
                  onClick={() => selectDay(day)}
                  aria-label={`${getDayName((toGregorian(viewDate.jy, viewDate.jm, day)).getDay(), locale)} ${day} ${getMonthName(viewDate.jm, locale)} ${viewDate.jy}`}
                  aria-current={isToday(day) ? "date" : undefined}
                  className={cn(
                    "w-9 h-9 text-sm rounded-lg flex items-center justify-center transition-colors",
                    isToday(day) && "font-bold text-accent",
                    isSelected(day) && "bg-accent text-fg-inverse",
                    !isSelected(day) && !isToday(day) && "hover:bg-bg-surface text-fg-primary",
                  )}
                >{day}</button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-primary">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); btnRef.current?.focus(); }}
              className="text-xs text-fg-muted hover:text-destructive"
            >
              {t("task.clearDate")}
            </button>
            <button
              type="button"
              onClick={() => { const n = toJalali(new Date()); setViewDate(n); selectDay(n.jd); }}
              className="text-xs text-accent hover:underline"
            >
              {t("common.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
