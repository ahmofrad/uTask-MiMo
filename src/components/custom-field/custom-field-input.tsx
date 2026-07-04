"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type CustomFieldDefinition = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  config?: {
    options?: string[];
    maxLength?: number;
    min?: number;
    max?: number;
  };
};

type CustomFieldInputProps = {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (_value: unknown) => void;
  error?: string;
  className?: string;
};

export function CustomFieldInput({ field, value, onChange, error, className }: CustomFieldInputProps) {
  const renderInput = () => {
    switch (field.type) {
      case "text":
        return (
          <Input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.config?.maxLength}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            min={field.config?.min}
            max={field.config?.max}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value || null)}
          />
        );
      case "select":
        return (
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value || null)}
            className="flex h-9 w-full rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <option value="">--</option>
            {(field.config?.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "multi_select":
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1">
            {(field.config?.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => {
                    const next = selected.includes(opt)
                      ? selected.filter((s: string) => s !== opt)
                      : [...selected, opt];
                    onChange(next);
                  }}
                  className="rounded border-border text-accent"
                />
                {opt}
              </label>
            ))}
          </div>
        );
      case "user":
        return (
          <Input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder="User ID"
          />
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-border text-accent"
            />
            {field.name}
          </label>
        );
      case "url":
        return (
          <Input
            type="url"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
          />
        );
      default:
        return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-sm font-medium text-fg">{field.name}</label>
      {renderInput()}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
