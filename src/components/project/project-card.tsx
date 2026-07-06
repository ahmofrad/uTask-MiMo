import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type ProjectCardProps = {
  id: string;
  name: string;
  description?: string | null;
  taskCount?: number;
  memberCount?: number;
  color?: string | null | undefined;
  className?: string;
};

export function ProjectCard({ id, name, description, taskCount, memberCount, color, className }: ProjectCardProps) {
  const t = useTranslations("project");
  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "block bg-bg-surface border border-border rounded-lg p-4 hover:bg-bg-surface-2 transition-colors",
        className,
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        {color && (
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        )}
        <h3 className="text-sm font-semibold text-fg truncate">{name}</h3>
      </div>
      {description && (
        <p className="text-xs text-fg-muted line-clamp-2 mb-3">{description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-fg-subtle">
        {taskCount !== undefined && <span>{t("tasksCount", { count: taskCount })}</span>}
        {memberCount !== undefined && <span>{t("membersCount", { count: memberCount })}</span>}
      </div>
    </Link>
  );
}
