import { describe, it, expect } from "vitest";
import { validateFieldValue } from "@/lib/custom-fields/validators";
import { CreateCustomFieldSchema } from "@/lib/custom-fields/schemas";

describe("validateFieldValue", () => {
  it("validates text values", () => {
    expect(validateFieldValue("text", "hello").valid).toBe(true);
    expect(validateFieldValue("text", "").valid).toBe(true);
    expect(validateFieldValue("text", 123).valid).toBe(false);
  });

  it("validates number values", () => {
    expect(validateFieldValue("number", 42).valid).toBe(true);
    expect(validateFieldValue("number", 0).valid).toBe(true);
    expect(validateFieldValue("number", -5).valid).toBe(true);
    expect(validateFieldValue("number", "abc").valid).toBe(false);
  });

  it("validates number with min/max config", () => {
    const config = { min: 0, max: 100 };
    expect(validateFieldValue("number", 50, config).valid).toBe(true);
    expect(validateFieldValue("number", -1, config).valid).toBe(false);
    expect(validateFieldValue("number", 101, config).valid).toBe(false);
  });

  it("validates checkbox values", () => {
    expect(validateFieldValue("checkbox", true).valid).toBe(true);
    expect(validateFieldValue("checkbox", false).valid).toBe(true);
    expect(validateFieldValue("checkbox", "true").valid).toBe(false);
  });

  it("validates date values", () => {
    expect(validateFieldValue("date", "2024-01-01T00:00:00Z").valid).toBe(true);
    expect(validateFieldValue("date", "not-a-date").valid).toBe(false);
  });

  it("validates URL values", () => {
    expect(validateFieldValue("url", "https://example.com").valid).toBe(true);
    expect(validateFieldValue("url", "not-a-url").valid).toBe(false);
  });

  it("validates select values", () => {
    expect(validateFieldValue("select", "option_a").valid).toBe(true);
    expect(validateFieldValue("select", 123).valid).toBe(false);
  });

  it("validates multi_select values", () => {
    expect(validateFieldValue("multi_select", ["a", "b"]).valid).toBe(true);
    expect(validateFieldValue("multi_select", "not-an-array").valid).toBe(false);
  });

  it("returns error for unknown type", () => {
    const result = validateFieldValue("unknown", "value");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unknown field type");
  });
});

describe("CreateCustomFieldSchema", () => {
  it("validates a valid custom field definition", () => {
    const result = CreateCustomFieldSchema.safeParse({
      name: "Story Points",
      key: "story_points",
      type: "number",
      required: true,
      configJson: { min: 1, max: 21 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid key format", () => {
    const result = CreateCustomFieldSchema.safeParse({
      name: "Bad Key",
      key: "Bad Key!",
      type: "text",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateCustomFieldSchema.safeParse({
      name: "",
      key: "empty",
      type: "text",
    });
    expect(result.success).toBe(false);
  });
});
