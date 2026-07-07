import { z } from "zod";

export const CustomFieldType = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "user",
  "checkbox",
  "url",
]);

export const TextConfig = z.object({
  maxLength: z.number().int().positive().optional(),
  regex: z.string().optional(),
});

export const NumberConfig = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  unit: z.string().optional(),
});

export const SelectOption = z.union([
  z.object({
    value: z.string(),
    label: z.string(),
    color: z.string().optional(),
  }),
  z.string().transform((s) => ({ value: s, label: s })),
]);

export const SelectConfig = z.object({
  options: z.array(SelectOption).min(1),
  allowOther: z.boolean().optional(),
});

export const DateConfig = z.object({
  includeTime: z.boolean().optional(),
});

export const FieldConfig = z.union([
  TextConfig,
  NumberConfig,
  SelectConfig,
  DateConfig,
  z.object({}),
]);

export const CreateCustomFieldSchema = z.object({
  name: z.string().min(1).max(255),
  key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, "Key must be a valid slug (lowercase, underscore-separated)"),
  type: CustomFieldType,
  required: z.boolean().optional().default(false),
  orderIndex: z.number().int().nonnegative().optional(),
  configJson: FieldConfig.optional(),
});

export const UpdateCustomFieldSchema = CreateCustomFieldSchema.partial();

export const CustomFieldValueSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
