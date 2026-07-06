import { z } from "zod";

const textValue = z.string().max(10000);
const numberValue = z.number();
const dateValue = z.string().datetime();
const selectValue = z.string();
const multiSelectValue = z.array(z.string());
const userValue = z.string().uuid();
const checkboxValue = z.boolean();
const urlValue = z.string().url();

export function validateFieldValue(
  type: string,
  value: unknown,
  config?: Record<string, unknown>,
): { valid: boolean; error?: string } {
  try {
    switch (type) {
      case "text": {
        const schema = textValue;
        if (config?.maxLength) {
          schema.max(z.number().parse(config.maxLength));
        }
        schema.parse(value);
        return { valid: true };
      }
      case "number": {
        let schema = numberValue;
        if (config?.min !== undefined) schema = schema.min(z.number().parse(config.min));
        if (config?.max !== undefined) schema = schema.max(z.number().parse(config.max));
        schema.parse(value);
        return { valid: true };
      }
      case "date":
        dateValue.parse(value);
        return { valid: true };
      case "select":
        selectValue.parse(value);
        return { valid: true };
      case "multi_select":
        multiSelectValue.parse(value);
        return { valid: true };
      case "user":
        userValue.parse(value);
        return { valid: true };
      case "checkbox":
        checkboxValue.parse(value);
        return { valid: true };
      case "url":
        urlValue.parse(value);
        return { valid: true };
      default:
        return { valid: false, error: `Unknown field type: ${type}` };
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { valid: false, error: err.issues[0]?.message ?? "Invalid value" };
    }
    return { valid: false, error: "Invalid value" };
  }
}
