import { Prisma } from "@prisma/client";

type FilterClause = {
  key: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
};

export function buildCustomFieldFilter(
  clauses: FilterClause[],
): Prisma.CustomFieldValueListRelationFilter | undefined {
  if (clauses.length === 0) return undefined;

  const andConditions: Prisma.CustomFieldValueWhereInput[] = [];

  for (const clause of clauses) {
    const condition: Prisma.CustomFieldValueWhereInput = {
      customField: { key: clause.key },
    };

    switch (clause.operator) {
      case "eq":
        condition.OR = [
          { valueText: { equals: String(clause.value) } },
          { valueNumber: { equals: Number(clause.value) } },
          { valueBool: { equals: Boolean(clause.value) } },
        ];
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
    }

    andConditions.push(condition);
  }

  return { some: { AND: andConditions } };
}
