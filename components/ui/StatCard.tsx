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
    default: "",
    ok: "border-status-ok/30",
    warn: "border-status-warn/30",
    err: "border-status-err/30",
  };
  return (
    <div
      className={cn(
        "card-padded relative overflow-hidden",
        toneClasses[tone]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {Icon && (
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-ink-700/80 bg-ink-800/70 text-accent-gold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-[22px] font-semibold leading-none tracking-tight text-ink-100">
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              "text-[11px] font-medium",
              trend === "up" && "text-status-ok",
              trend === "down" && "text-status-err",
              trend === "flat" && "text-ink-300"
            )}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "→"}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1.5 text-[11px] text-ink-300">{hint}</p>
      )}
      {/* Hairline gold→orange accent bar, 2px tall, anchored to bottom edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-accent-gold/70 via-accent-orange/60 to-accent-gold/30 opacity-70"
      />
    </div>
  );
}
