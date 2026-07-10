import { cn } from "@/lib/cn";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
};

/**
 * uTask brand mark — a stylized "T" (horizontal bar over a vertical stem).
 * Uses `currentColor` so the surrounding text color drives the fill.
 */
export function Logo({ size = 28, showWordmark = false, className, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label="uTask"
        className="shrink-0"
      >
        <rect x="3" y="3" width="26" height="26" rx="7" className="fill-accent" />
        <path
          d="M9 11h14M16 11v12"
          stroke="var(--accent-fg)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark && (
        <span className={cn("text-lg font-bold tracking-tight", wordmarkClassName)}>uTask</span>
      )}
    </span>
  );
}
