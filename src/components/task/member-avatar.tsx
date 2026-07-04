import { Avatar } from "@/components/ui/avatar";

type MemberAvatarProps = {
  displayName: string;
  avatarUrl?: string | null | undefined;
  role?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

export function MemberAvatar({ displayName, avatarUrl, role, size = "md" }: MemberAvatarProps) {
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="inline-flex items-center gap-2">
      <Avatar initials={initials} imageUrl={avatarUrl} size={size} />
      <div className="flex flex-col">
        <span className="text-sm text-fg leading-tight">{displayName}</span>
        {role && <span className="text-xs text-fg-muted">{role}</span>}
      </div>
    </div>
  );
}
