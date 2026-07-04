import { cn } from "@/lib/cn";

const TAG_COLORS = [
  "bg-info-bg text-info border-info/20",
  "bg-success-bg text-success border-success/20",
  "bg-warning-bg text-warning border-warning/20",
  "bg-danger-bg text-destructive border-danger/20",
  "bg-accent-bg text-accent border-accent/20",
];

type TagChipProps = {
  label: string;
  colorIndex?: number;
  className?: string;
};

export function TagChip({ label, colorIndex = 0, className }: TagChipProps) {
  const color = TAG_COLORS[colorIndex % TAG_COLORS.length] ?? TAG_COLORS[0];
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
      color,
      className,
    )}>
      {label}
    </span>
  );
}
