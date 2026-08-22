"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { formatDateTime, type Locale } from "@/lib/date/format";

type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  config?: Record<string, unknown>;
};

type Props = {
  field: CustomFieldDef;
  value: unknown;
  className?: string;
};

export function CustomFieldValue({ field, value, className }: Props) {
  const locale = useLocale() as Locale;
  if (value === null || value === undefined || value === "") {
    return (
      <div className={cn("space-y-1", className)}>
        <label className="block text-xs text-fg-muted">{field.name}</label>
        <p className="text-sm text-fg-subtle italic">—</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs text-fg-muted">{field.name}</label>
      <div className="text-sm text-fg-primary">{renderValue(field, value, locale)}</div>
    </div>
  );
}

function renderValue(field: CustomFieldDef, value: unknown, locale: Locale) {
  switch (field.type) {
    case "text":
    case "url":
      return <TextFieldValue value={value} />;
    case "number":
      return <NumberFieldValue value={value} />;
    case "date":
      return <DateFieldValue value={value} locale={locale} />;
    case "select":
      return <SelectFieldValue value={value} />;
    case "multi_select":
      return <MultiSelectFieldValue value={value} />;
    case "user":
      return <TextFieldValue value={value} />;
    case "checkbox":
      return <CheckboxFieldValue value={value} />;
    default:
      return <span>{String(value)}</span>;
  }
}

function TextFieldValue({ value }: { value: unknown }) {
  return <span className="break-words">{String(value)}</span>;
}

function NumberFieldValue({ value }: { value: unknown }) {
  return <span className="font-mono tabular-nums">{String(value)}</span>;
}

function DateFieldValue({ value, locale }: { value: unknown; locale: Locale }) {
  if (value instanceof Date || typeof value === "string") {
    const d = typeof value === "string" ? new Date(value) : value;
    return <span>{formatDateTime(d, locale)}</span>;
  }
  return <span>{String(value)}</span>;
}

function SelectFieldValue({ value }: { value: unknown }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-accent-bg text-accent">
      {String(value)}
    </span>
  );
}

function MultiSelectFieldValue({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [String(value)];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-accent-bg text-accent">
          {String(item)}
        </span>
      ))}
    </div>
  );
}

function CheckboxFieldValue({ value }: { value: unknown }) {
  const checked = Boolean(value);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", checked ? "text-success" : "text-fg-muted")}>
      {checked ? "✓" : "○"}
    </span>
  );
}