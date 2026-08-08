export type DepartmentParent = {
  id: string;
  parentId: string | null;
};

export function collectDepartmentSubtreeIds(
  rootId: string,
  departments: readonly DepartmentParent[],
): Set<string> {
  const byParent = new Map<string | null, string[]>();
  for (const department of departments) {
    const siblings = byParent.get(department.parentId) ?? [];
    siblings.push(department.id);
    byParent.set(department.parentId, siblings);
  }

  const knownIds = new Set(departments.map((department) => department.id));
  if (!knownIds.has(rootId)) return new Set();

  const result = new Set<string>();
  const pending = [rootId];

  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || result.has(currentId)) continue;

    result.add(currentId);
    for (const childId of byParent.get(currentId) ?? []) {
      if (!result.has(childId)) pending.push(childId);
    }
  }

  return result;
}
