"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { icons, type IconName } from "./registry";
import { MIRRORED_ICONS } from "./mirror";

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
};

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  const locale = useLocale();
  const Comp = icons[name];
  if (!Comp) return null;
  const mirror = MIRRORED_ICONS.has(name) && locale === "fa-IR";
  return <Comp size={size} className={cn(mirror && "scale-x-[-1]", className)} {...rest} />;
}
