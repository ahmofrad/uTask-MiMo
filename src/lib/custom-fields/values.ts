import { prisma } from "@/lib/db";

export async function getCustomFieldsForProject(projectId: string) {
  return prisma.customField.findMany({
    where: { projectId, archivedAt: null },
    orderBy: { orderIndex: "asc" },
  });
}

export async function getCustomFieldValuesForTask(taskId: string) {
  const values = await prisma.customFieldValue.findMany({
    where: { taskId },
    include: { customField: true },
  });

  const map: Record<string, unknown> = {};
  for (const v of values) {
    map[v.customField.key] =
      v.valueText ??
      v.valueNumber ??
      v.valueDate ??
      v.valueBool ??
      v.valueJson ??
      null;
  }
  return map;
}

export async function setCustomFieldValues(
  taskId: string,
  projectId: string,
  values: Record<string, unknown>,
) {
  const fields = await getCustomFieldsForProject(projectId);
  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  for (const [key, value] of Object.entries(values)) {
    const field = fieldMap.get(key);
    if (!field) {
      const { logger } = await import("@/lib/logging");
      logger.warn({ key, projectId, availableKeys: [...fieldMap.keys()] }, "Custom field not found for key");
      continue;
    }

    const data: Record<string, unknown> = { taskId, customFieldId: field.id };

    switch (field.type) {
      case "text":
      case "url":
        data.valueText = String(value);
        break;
      case "number":
        data.valueNumber = Number(value);
        break;
      case "date":
        data.valueDate = new Date(String(value));
        break;
      case "checkbox":
        data.valueBool = Boolean(value);
        break;
      case "select":
      case "multi_select":
      case "user":
        data.valueJson = value;
        break;
    }

    try {
      await prisma.customFieldValue.upsert({
        where: { taskId_customFieldId: { taskId, customFieldId: field.id } },
        update: data,
        create: data as never,
      });
    } catch (err) {
      const { logger } = await import("@/lib/logging");
      logger.error({ err, taskId, fieldKey: key, fieldId: field.id }, "Failed to save custom field value");
    }
  }
}
