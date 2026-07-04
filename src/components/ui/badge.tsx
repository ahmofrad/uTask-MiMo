import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-bg-surface-2 text-fg-muted border border-border",
        accent: "bg-accent-bg text-accent border border-accent/20",
        success: "bg-success-bg text-success border border-success/20",
        warning: "bg-warning-bg text-warning border border-warning/20",
        danger: "bg-danger-bg text-destructive border border-danger/20",
        info: "bg-info-bg text-info border border-info/20",
        outline: "bg-transparent text-fg-muted border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
