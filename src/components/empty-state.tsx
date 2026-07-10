import Link from "next/link";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-4", className)}>
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        className="text-fg-subtle mb-4"
        aria-hidden="true"
      >
        <rect x="18" y="24" width="60" height="48" rx="8" stroke="currentColor" strokeWidth="2.5" />
        <path d="M18 38h60" stroke="currentColor" strokeWidth="2.5" />
        <path d="M34 52h28M34 62h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="68" cy="66" r="14" stroke="currentColor" strokeWidth="2.5" />
        <path d="M78 76l8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-base font-medium text-fg">{title}</p>
      {description && <p className="text-sm text-fg-muted mt-1 max-w-xs">{description}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/85 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
