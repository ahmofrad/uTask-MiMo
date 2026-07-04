"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Department = {
  id: string;
  name: string;
  parentId: string | null;
  managerUserId: string | null;
  _count: { projects: number };
};

type Props = {
  departments: Department[];
};

export function DepartmentTree({ departments: initial }: Props) {
  const [departments, setDepartments] = useState(initial);
  const [newName, setNewName] = useState("");

  async function addDepartment() {
    if (!newName.trim()) return;
    const res = await fetch("/api/v1/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      const json = await res.json();
      setDepartments((prev) => [...prev, json.data]);
      setNewName("");
    }
  }

  async function removeDepartment(id: string) {
    const res = await fetch(`/api/v1/departments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name"
          className="flex-1 px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary"
          onKeyDown={(e) => e.key === "Enter" && addDepartment()}
        />
        <Button onClick={addDepartment}>Add</Button>
      </div>
      <div className="space-y-2">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="flex items-center justify-between p-3 border border-border-primary rounded-lg"
          >
            <div>
              <span className="text-fg-primary font-medium">{dept.name}</span>
              <span className="ms-3 text-sm text-fg-secondary">
                {dept._count.projects} projects
              </span>
              {dept.managerUserId && (
                <span className="ms-3 text-sm text-fg-tertiary">
                  Manager: {dept.managerUserId}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeDepartment(dept.id)}>
              Delete
            </Button>
          </div>
        ))}
        {departments.length === 0 && (
          <p className="text-fg-tertiary text-sm">No departments yet.</p>
        )}
      </div>
    </div>
  );
}
