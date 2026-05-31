import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MetricItem {
  label: string;
  /** Used count so far today. */
  used: number;
  /** Daily cap from server env. */
  cap: number;
  /** Singular unit noun, e.g. "chat", "image", "action". */
  unit: string;
  icon: LucideIcon;
}

/**
 * Compact metric strip — one tight row of small stats (NOT big cards).
 * Each tile shows today's remaining-vs-cap usage with a hairline progress
 * track. Real numbers only (driven by usage_events + env DAILY_CAPS); no
 * fabricated values. Dual-theme, high-contrast.
 */
export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div className="card grid grid-cols-2 divide-x divide-ink-200 dark:divide-ink-800 md:grid-cols-4">
      {items.map(({ label, used, cap, unit, icon: Icon }, i) => {
        const remaining = Math.max(cap - used, 0);
        const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
        const value = `${remaining}`;
        const sub =
          used === 0
            ? `${cap} ${unit}s ready today`
            : `${used} used · cap ${cap}`;
        return (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-1.5 px-4 py-3",
              i >= 2 && "border-t border-ink-200 dark:border-ink-800 md:border-t-0"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                {label}
              </p>
              <Icon
                size={13}
                className="shrink-0 text-ink-500 dark:text-ink-400"
                aria-hidden
              />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold leading-none tracking-tight text-ink-900 dark:text-ink-100">
                {value}
              </span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">
                {unit}s left
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-champagne via-accent-gold to-accent-orange"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-500 dark:text-ink-400">{sub}</p>
          </div>
        );
      })}
    </div>
  );
}
