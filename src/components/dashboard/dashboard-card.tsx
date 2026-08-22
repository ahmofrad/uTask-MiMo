"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

type DashboardCardProps = {
  label: string;
  value: number;
  color: "accent" | "danger" | "success" | "info";
};

const colorClasses: Record<string, string> = {
  accent: "bg-accent-bg text-accent border-accent/20",
  danger: "bg-danger-bg text-destructive border-danger/20",
  success: "bg-success-bg text-success border-success/20",
  info: "bg-info-bg text-info border-info/20",
};

export const DashboardCard = memo(function DashboardCard({ label, value, color }: DashboardCardProps) {
  return (
    <div className={cn(
      "rounded-xl border p-5 flex flex-col gap-1 shadow-sm",
      colorClasses[color] ?? colorClasses.accent,
    )}>
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-sm opacity-80">{label}</span>
    </div>
  );
});
