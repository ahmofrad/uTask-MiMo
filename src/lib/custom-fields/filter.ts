import { Prisma } from "@prisma/client";

export type CustomFieldFilterClause = {
  key: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "array_contains";
  value: unknown;
};

/** A value that looks like a date-only (or ISO) string. */
function isDateLike(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime());
}

/** `eq` matches across every typed column so a single clause works for all field types. */
function buildEqCondition(value: unknown): Prisma.CustomFieldValueWhereInput[] {
  const or: Prisma.CustomFieldValueWhereInput[] = [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    or.push({ valueText: { equals: String(value) } });
  }
  const numeric = Number(value);
  if (value !== "" && value !== null && Number.isFinite(numeric)) {
    or.push({ valueNumber: { equals: numeric } });
  }
  if (typeof value === "boolean") {
    or.push({ valueBool: { equals: value } });
  }
  if (isDateLike(value)) {
    or.push({ valueDate: { equals: new Date(value) } });
  }
  or.push({ valueJson: { equals: value as Prisma.InputJsonValue } });
  return or;
}

export function buildCustomFieldFilter(
  clauses: CustomFieldFilterClause[],
): Prisma.CustomFieldValueListRelationFilter | undefined {
  if (clauses.length === 0) return undefined;

  const andConditions: Prisma.CustomFieldValueWhereInput[] = [];

  for (const clause of clauses) {
    const condition: Prisma.CustomFieldValueWhereInput = {
      customField: { key: clause.key },
    };

    switch (clause.operator) {
      case "eq":
        condition.OR = buildEqCondition(clause.value);
        break;
      case "neq":
        condition.NOT = {
          OR: [
            { valueText: { equals: String(clause.value) } },
            { valueNumber: { equals: Number(clause.value) } },
          ],
        };
        break;
      case "gt":
        condition.valueNumber = { gt: Number(clause.value) };
        break;
      case "gte":
        condition.valueNumber = { gte: Number(clause.value) };
        break;
      case "lt":
        condition.valueNumber = { lt: Number(clause.value) };
        break;
      case "lte":
        condition.valueNumber = { lte: Number(clause.value) };
        break;
      case "contains":
        condition.valueText = { contains: String(clause.value), mode: "insensitive" };
        break;
      case "array_contains":
        // multi_select values live in valueJson as arrays.
        condition.valueJson = { array_contains: clause.value as Prisma.InputJsonValue };
        break;
      case "in":
        if (Array.isArray(clause.value)) {
          condition.valueText = { in: clause.value.map(String) };
        }
        break;
    }

    andConditions.push(condition);
  }

  return { some: { AND: andConditions } };
}
