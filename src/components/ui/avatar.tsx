import { cn } from "@/lib/cn";
import { cva } from "class-variance-authority";

const avatarVariants = cva(
  "inline-flex items-center justify-center rounded-full bg-accent-bg text-accent font-medium shrink-0",
  {
    variants: {
      size: {
        sm: "w-6 h-6 text-xs",
        md: "w-8 h-8 text-sm",
        lg: "w-10 h-10 text-base",
        xl: "w-12 h-12 text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type AvatarProps = {
  initials: string;
  imageUrl?: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

export function Avatar({ initials, imageUrl, size = "md", className }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={initials}
        className={cn(avatarVariants({ size }), "object-cover", className)}
      />
    );
  }
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
