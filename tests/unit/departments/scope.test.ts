import { describe, expect, it } from "vitest";
import { collectDepartmentSubtreeIds } from "@/lib/departments/scope";

describe("collectDepartmentSubtreeIds", () => {
  const departments = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
    { id: "grandchild", parentId: "child" },
    { id: "sibling", parentId: "other-root" },
  ];

  it("includes the root and every descendant, but not siblings", () => {
    expect(collectDepartmentSubtreeIds("root", departments)).toEqual(
      new Set(["root", "child", "grandchild"]),
    );
  });

  it("returns an empty set when the root does not exist", () => {
    expect(collectDepartmentSubtreeIds("missing", departments)).toEqual(new Set());
  });

  it("terminates safely for cyclic input", () => {
    const cyclic = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];

    expect(collectDepartmentSubtreeIds("a", cyclic)).toEqual(new Set(["a", "b"]));
  });
});
