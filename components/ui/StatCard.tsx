import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "flat";
  tone?: "default" | "ok" | "warn" | "err";
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
}: StatCardProps) {
  const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
    default: "border-ink-700/70",
    ok: "border-status-ok/30",
    warn: "border-status-warn/30",
    err: "border-status-err/30",
  };
  return (
    <div className={cn("card-padded relative overflow-hidden", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {Icon && (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 text-ink-200">
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <p className="text-2xl font-semibold text-ink-100">{value}</p>
        {trend && (
          <span
            className={cn(
              "text-xs",
              trend === "up" && "text-status-ok",
              trend === "down" && "text-status-err",
              trend === "flat" && "text-ink-300"
            )}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "→"}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-300">{hint}</p>}
    </div>
  );
}
