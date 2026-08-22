"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/date/format";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { Tooltip } from "@/components/ui/tooltip";

export type TimelineDay = {
  date: Date;
  offset: number;
  label: string;
  isMonthStart: boolean;
  isToday: boolean;
  isNonWorking: boolean;
  isDayOff: boolean;
  holidayName: string;
};

export type TimelineMonth = {
  key: string;
  label: string;
  startOffset: number;
  dayCount: number;
};

type Props = {
  days: TimelineDay[];
  months: TimelineMonth[];
  dayWidth: number;
  totalWidth: number;
  todayOffset: number | null;
  timelineXForOffset: (_offset: number, _itemWidth?: number) => number;
};

export function GanttHeader({
  days,
  months,
  dayWidth,
  totalWidth,
  todayOffset,
  timelineXForOffset,
}: Props) {
  const t = useTranslations("task");
  const locale = useLocale() as Locale;
  const { shortDate } = useFormattedDate();

  return (
    <div className="flex border-b border-border-primary bg-bg-secondary">
      <div className="sticky start-0 z-30 flex h-20 w-72 shrink-0 items-end border-e border-border-primary bg-bg-secondary p-3 text-xs font-semibold text-fg-muted">
        {t("wbs")}
      </div>
      <div
        dir="ltr"
        className="relative h-20 shrink-0"
        style={{ width: totalWidth }}
      >
        <div className="absolute inset-x-0 top-0 h-9 border-b border-border-primary bg-bg-secondary">
          {months.map((month) => (
            <div
              key={month.key}
              data-testid="gantt-timeline-month"
              dir={locale === "fa-IR" ? "rtl" : "ltr"}
              className="absolute top-0 flex h-9 items-center border-e border-border-primary px-3 text-[15px] font-bold text-fg-primary"
              style={{
                left: `${timelineXForOffset(month.startOffset, month.dayCount * dayWidth)}px`,
                width: `${month.dayCount * dayWidth}px`,
              }}
            >
              <span className="truncate">{month.label}</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 top-9 h-11 bg-bg-primary">
          {days.map((day) => {
            const cell = (
              <div
                data-testid="gantt-timeline-day"
                data-day-offset={day.offset}
                data-holiday-name={day.holidayName || undefined}
                dir={locale === "fa-IR" ? "rtl" : "ltr"}
                className={`absolute top-0 flex h-11 items-center justify-center border-e border-border-secondary/70 text-[15px] font-semibold leading-none ${
                  day.isMonthStart ? "border-s-2 border-s-border-strong" : ""
                } ${
                  day.isToday
                    ? "bg-accent-bg text-accent"
                    : day.isDayOff
                      ? "bg-danger-bg/60 text-danger"
                      : day.isNonWorking
                        ? "bg-bg-surface-2/70"
                        : "text-fg-secondary"
                }`}
                style={{
                  left: `${timelineXForOffset(day.offset, dayWidth)}px`,
                  width: `${dayWidth}px`,
                }}
              >
                {day.label}
              </div>
            );
            return day.holidayName ? (
              <Tooltip
                key={day.offset}
                data-testid="gantt-holiday-tooltip"
                content={
                  <span dir={locale === "fa-IR" ? "rtl" : "ltr"} className="flex flex-col gap-0.5">
                    <span className="font-semibold text-danger">{day.holidayName}</span>
                    <span className="text-fg-muted">{shortDate(day.date)}</span>
                  </span>
                }
              >
                {cell}
              </Tooltip>
            ) : (
              <Fragment key={day.offset}>{cell}</Fragment>
            );
          })}
        </div>
        {todayOffset != null ? (
          <div
            className="pointer-events-none absolute top-9 z-10 h-11 w-0.5 bg-danger/70"
            style={{ left: `${timelineXForOffset(todayOffset, dayWidth) + dayWidth / 2}px` }}
          />
        ) : null}
      </div>
    </div>
  );
}