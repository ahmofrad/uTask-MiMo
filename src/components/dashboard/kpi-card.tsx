"use client";

type KpiCardProps = {
  label: string;
  value: number | string;
  color?: "accent" | "danger" | "success" | "info";
  change?: string;
};

const colorMap = {
  accent: "bg-accent-bg text-accent",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
};

export function KpiCard({ label, value, color = "accent", change }: KpiCardProps) {
  return (
    <div className={`rounded-xl border border-border-primary p-5 ${colorMap[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-80 mt-1">{label}</div>
      {change && (
        <div className="text-xs opacity-60 mt-2">{change}</div>
      )}
    </div>
  );
}
