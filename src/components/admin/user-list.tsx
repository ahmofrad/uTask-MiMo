"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type UserWithRole = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { type: string }[];
};

type Props = {
  users: UserWithRole[];
};

function getRole(roles: { type: string }[]): string {
  return roles[0]?.type ?? "none";
}

export function AdminUserList({ users }: Props) {
  const [list, setList] = useState(users);

  async function toggleSuspend(userId: string, currentStatus: string) {
    const res = await fetch(`/api/v1/users/${userId}/suspend`, { method: "POST" });
    if (res.ok) {
      setList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: currentStatus === "suspended" ? "active" : "suspended" }
            : u,
        ),
      );
    }
  }

  return (
    <div className="overflow-x-auto border border-border-primary rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-fg-secondary">
          <tr>
            <th className="text-start ps-4 pe-4 py-3 font-medium">Name</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">Email</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">Role</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">Status</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {list.map((user) => (
            <tr key={user.id} className="hover:bg-bg-secondary/50">
              <td className="ps-4 pe-4 py-3 text-fg-primary">{user.displayName}</td>
              <td className="ps-4 pe-4 py-3 text-fg-secondary">{user.email}</td>
              <td className="ps-4 pe-4 py-3">
                <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent">
                  {getRole(user.roles)}
                </span>
              </td>
              <td className="ps-4 pe-4 py-3">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    user.status === "active"
                      ? "bg-success-bg text-success"
                      : user.status === "suspended"
                        ? "bg-danger-bg text-destructive"
                        : "bg-warning-bg text-warning"
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td className="ps-4 pe-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSuspend(user.id, user.status)}
                >
                  {user.status === "suspended" ? "Restore" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
