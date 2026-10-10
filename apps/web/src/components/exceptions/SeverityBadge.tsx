"use client";

type Severity = "low" | "medium" | "high";

const CONFIG: Record<Severity, { label: string; color: string; icon: string }> = {
  low: { label: "Basse", color: "bg-blue-100 text-blue-800", icon: "🔵" },
  medium: { label: "Moyenne", color: "bg-orange-100 text-orange-800", icon: "🟠" },
  high: { label: "Haute", color: "bg-red-100 text-red-800", icon: "🔴" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const config = CONFIG[severity as Severity] || CONFIG.medium;
  return (
    <span
      className={`text-xs font-semibold px-2 py-1 rounded-full ${config.color}`}
    >
      {config.icon} {config.label}
    </span>
  );
}