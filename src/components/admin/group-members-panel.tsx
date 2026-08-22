"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

type GroupMember = { id: string; displayName: string; email: string };
type UserOption = { id: string; displayName: string; email: string };

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent";

type Props = {
  groupId: string;
  members: GroupMember[];
  loading: boolean;
  query: string;
  suggestions: UserOption[];
  addError: string | null;
  addNote: string | null;
  onQueryChange: (_groupId: string, _q: string) => void;
  onAddMember: (_groupId: string, _user: UserOption) => void;
  onRemoveMember: (_groupId: string, _userId: string) => void;
};

export const GroupMembersPanel = memo(function GroupMembersPanel({
  groupId,
  members,
  loading,
  query,
  suggestions,
  addError,
  addNote,
  onQueryChange,
  onAddMember,
  onRemoveMember,
}: Props) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  return (
    <div className="mt-2 ms-4 ps-4 border-s border-border-primary space-y-2">
      <div className="relative max-w-sm">
        <input
          className={inputClass}
          value={query}
          onChange={(e) => onQueryChange(groupId, e.target.value)}
          placeholder={t("addMemberPlaceholder")}
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border-primary bg-bg-primary shadow-lg">
            {suggestions.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onAddMember(groupId, u)}
                  className="w-full text-start px-3 py-2 text-sm text-fg-primary hover:bg-bg-surface"
                >
                  <span className="block">{u.displayName}</span>
                  <span className="block text-xs text-fg-muted">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {addError && (
        <p className="text-xs text-destructive">{addError}</p>
      )}
      {addNote && (
        <p className="text-xs text-fg-muted">{addNote}</p>
      )}
      {loading ? (
        <p className="text-sm text-fg-muted">{tc("loading")}</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-fg-tertiary">{t("noGroupMembers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-primary">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-fg-secondary">
              <tr>
                <th className="text-start ps-3 pe-2 py-2 font-medium">{t("memberColumn")}</th>
                <th className="text-start ps-2 pe-2 py-2 font-medium">{t("emailColumn")}</th>
                <th className="text-end ps-2 pe-3 py-2 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-bg-secondary/50">
                  <td className="ps-3 pe-2 py-2 text-fg-primary whitespace-nowrap">
                    {member.displayName}
                  </td>
                  <td className="ps-2 pe-2 py-2 text-fg-secondary">
                    {member.email ?? "—"}
                  </td>
                  <td className="ps-2 pe-3 py-2 text-end">
                    <button
                      type="button"
                      onClick={() => onRemoveMember(groupId, member.id)}
                      className="text-xs text-fg-muted hover:text-destructive"
                      aria-label={t("removeMember", { name: member.displayName })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});