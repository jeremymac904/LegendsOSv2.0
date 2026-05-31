"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  ListChecks,
  PlugZap,
  ScrollText,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

type TabKey = "live" | "jobs" | "providers" | "activity" | "audit";

const TABS: { key: TabKey; label: string; icon: typeof Activity }[] = [
  { key: "live", label: "Live usage", icon: Sparkles },
  { key: "jobs", label: "Automation jobs", icon: ListChecks },
  { key: "providers", label: "Providers", icon: PlugZap },
  { key: "activity", label: "Activity feeds", icon: Activity },
  { key: "audit", label: "Audit log", icon: ScrollText },
];

interface Props {
  live: ReactNode;
  jobs: ReactNode;
  providers: ReactNode;
  activity: ReactNode;
  audit: ReactNode;
}

// Compact tab switcher for the Admin Center overview. Folds the old wall of
// stacked cards into one card with five in-place tabs so the operator sees
// the most important pane (live usage) above the fold and reaches the rest
// in a click — no scrolling through six full-width sections.
export function AdminOverviewTabs({
  live,
  jobs,
  providers,
  activity,
  audit,
}: Props) {
  const [active, setActive] = useState<TabKey>("live");
  const panes: Record<TabKey, ReactNode> = {
    live,
    jobs,
    providers,
    activity,
    audit,
  };

  return (
    <section className="card-padded space-y-4">
      <div
        role="tablist"
        aria-label="Admin overview sections"
        className="flex flex-wrap gap-1.5 border-b border-ink-200 pb-3 dark:border-ink-800"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                isActive
                  ? "border-accent-gold/50 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-300 dark:hover:text-ink-100"
              )}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{panes[active]}</div>
    </section>
  );
}
