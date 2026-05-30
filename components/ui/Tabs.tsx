"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  /** Id of the tab open on first render. Defaults to the first tab. */
  defaultTabId?: string;
  /** "underline" (default) or "pill" active styling. */
  variant?: "underline" | "pill";
  className?: string;
}

/**
 * Dark-gold-glass tabs for grouping dense content into switchable panels.
 * Accessible: a `tablist` of `tab` buttons drives a single `tabpanel`.
 */
export function Tabs({
  tabs,
  defaultTabId,
  variant = "underline",
  className,
}: TabsProps) {
  const initial =
    defaultTabId && tabs.some((t) => t.id === defaultTabId)
      ? defaultTabId
      : tabs[0]?.id;
  const [activeId, setActiveId] = useState<string | undefined>(initial);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!active) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "scrollbar-thin flex gap-1 overflow-x-auto",
          variant === "underline" &&
            "border-b border-ink-200 dark:border-ink-800"
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold/50",
                variant === "underline"
                  ? cn(
                      "-mb-px border-b-2 px-3 py-2",
                      isActive
                        ? "border-accent-gold text-accent-gold"
                        : "border-transparent text-ink-400 hover:text-ink-900 dark:hover:text-ink-100"
                    )
                  : cn(
                      "rounded-full border px-3 py-1.5",
                      isActive
                        ? "border-accent-champagne/40 bg-gradient-to-b from-accent-champagne/15 to-accent-orange/10 text-accent-champagne"
                        : "border-transparent text-ink-400 hover:text-ink-900 dark:hover:text-ink-100"
                    )
              )}
            >
              {Icon && <Icon size={14} aria-hidden />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
      >
        {active.content}
      </div>
    </div>
  );
}
