import { describe, expect, it } from "vitest";
import { buildCustomFieldFilter, type CustomFieldFilterClause } from "@/lib/custom-fields/filter";

function clause(key: string, operator: CustomFieldFilterClause["operator"], value: unknown): CustomFieldFilterClause {
  return { key, operator, value };
}

describe("buildCustomFieldFilter", () => {
  it("returns undefined for an empty clause list", () => {
    expect(buildCustomFieldFilter([])).toBeUndefined();
  });

  it("builds an eq condition across every typed column", () => {
    const filter = buildCustomFieldFilter([clause("stage", "eq", "approved")]);
    expect(filter).toEqual({
      some: {
        AND: [
          {
            customField: { key: "stage" },
            OR: [
              { valueText: { equals: "approved" } },
              { valueJson: { equals: "approved" } },
            ],
          },
        ],
      },
    });
  });

  it("adds a number column for numeric eq", () => {
    const filter = buildCustomFieldFilter([clause("hours", "eq", 8)]);
    const or = filter?.some.AND?.[0] as { OR?: unknown[] };
    expect(or.OR).toContainEqual({ valueText: { equals: "8" } });
    expect(or.OR).toContainEqual({ valueNumber: { equals: 8 } });
  });

  it("adds a boolean column for boolean eq", () => {
    const filter = buildCustomFieldFilter([clause("flagged", "eq", true)]);
    const or = filter?.some.AND?.[0] as { OR?: unknown[] };
    expect(or.OR).toContainEqual({ valueBool: { equals: true } });
  });

  it("adds a date column for date-like eq values", () => {
    const filter = buildCustomFieldFilter([clause("deadline", "eq", "2026-09-01")]);
    const or = filter?.some.AND?.[0] as { OR?: unknown[] };
    expect(or.OR).toContainEqual({ valueDate: { equals: new Date("2026-09-01") } });
  });

  it("does not add a number column for non-numeric strings", () => {
    const filter = buildCustomFieldFilter([clause("stage", "eq", "approved")]);
    const or = filter?.some.AND?.[0] as { OR?: unknown[] };
    expect(or.OR).not.toContainEqual(expect.objectContaining({ valueNumber: expect.anything() }));
  });

  it("builds contains with case-insensitive text search", () => {
    const filter = buildCustomFieldFilter([clause("name", "contains", "api")]);
    expect(filter).toEqual({
      some: {
        AND: [
          {
            customField: { key: "name" },
            valueText: { contains: "api", mode: "insensitive" },
          },
        ],
      },
    });
  });

  it("builds array_contains against valueJson", () => {
    const filter = buildCustomFieldFilter([clause("labels", "array_contains", "urgent")]);
    expect(filter).toEqual({
      some: {
        AND: [
          {
            customField: { key: "labels" },
            valueJson: { array_contains: "urgent" },
          },
        ],
      },
    });
  });

  it("builds numeric comparisons for gt/gte/lt/lte", () => {
    expect(buildCustomFieldFilter([clause("hours", "gt", 8)])).toEqual({
      some: { AND: [{ customField: { key: "hours" }, valueNumber: { gt: 8 } }] },
    });
    expect(buildCustomFieldFilter([clause("hours", "lte", 40)])).toEqual({
      some: { AND: [{ customField: { key: "hours" }, valueNumber: { lte: 40 } }] },
    });
  });

  it("builds neq as a negated OR across text and number", () => {
    const filter = buildCustomFieldFilter([clause("stage", "neq", "done")]);
    expect(filter).toEqual({
      some: {
        AND: [
          {
            customField: { key: "stage" },
            NOT: { OR: [{ valueText: { equals: "done" } }, { valueNumber: { equals: NaN } }] },
          },
        ],
      },
    });
  });

  it("builds in against valueText for array values", () => {
    const filter = buildCustomFieldFilter([clause("stage", "in", ["a", "b"])]);
    expect(filter).toEqual({
      some: {
        AND: [
          { customField: { key: "stage" }, valueText: { in: ["a", "b"] } },
        ],
      },
    });
  });

  it("ANDs multiple clauses together", () => {
    const filter = buildCustomFieldFilter([
      clause("stage", "eq", "open"),
      clause("hours", "gte", 4),
    ]);
    const conditions = filter?.some.AND as unknown[];
    expect(conditions).toHaveLength(2);
  });
});
