"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { CustomFieldInput } from "@/components/custom-field/custom-field-input";

type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  config: Record<string, unknown>;
};

type Props = {
  schema: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (_key: string, _value: unknown) => Promise<void>;
};

export const TaskCustomFieldsCard = memo(function TaskCustomFieldsCard({
  schema,
  values,
  onChange,
}: Props) {
  const t = useTranslations();

  if (schema.length === 0) return null;

  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
      <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-3">
        {t("task.customFields")}
      </h4>
      <div className="space-y-3">
        {schema.map((field) => (
          <CustomFieldInput
            key={field.id}
            field={field}
            value={values[field.key] ?? null}
            onChange={(value) => void onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
});