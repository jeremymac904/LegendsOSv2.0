"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface DashboardTab {
  id: string;
  label: string;
  /** Optional count badge (e.g. number of drafts). 0 still renders so the
   *  user can tell "no items" from "not loaded". Pass null to hide. */
  count?: number | null;
  content: React.ReactNode;
}

/**
 * Client tab container for the dashboard command center. The server component
 * renders all tab contents up front (data is already fetched server-side) and
 * passes them as React nodes; this component only toggles which panel is
 * visible. That keeps the heavy Supabase reads on the server while folding the
 * old card-wall of full-width sections into one compact, above-the-fold panel.
 */
export function DashboardPanels({
  tabs,
  rightSlot,
}: {
  tabs: DashboardTab[];
  rightSlot?: React.ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <section className="card-padded">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 pb-3 dark:border-ink-800">
        <div
          role="tablist"
          aria-label="Dashboard panels"
          className="flex flex-wrap items-center gap-1.5"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTab?.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition",
                  selected
                    ? "bg-ink-100 text-ink-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-ink-800 dark:text-ink-100"
                    : "text-ink-600 hover:bg-ink-100/60 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/60 dark:hover:text-ink-100"
                )}
              >
                {tab.label}
                {tab.count != null && (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                      selected
                        ? "bg-accent-gold/20 text-accent-orange dark:text-accent-gold"
                        : "bg-ink-200/70 text-ink-600 dark:bg-ink-700/70 dark:text-ink-300"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {rightSlot && (
          <div className="flex items-center gap-2">{rightSlot}</div>
        )}
      </div>

      <div className="mt-4" role="tabpanel">
        {activeTab?.content}
      </div>
    </section>
  );
}
