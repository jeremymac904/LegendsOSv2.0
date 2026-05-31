"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  /** Optional element rendered on the right of the header (e.g. a chip). */
  badge?: ReactNode;
  /** Optional lucide icon component for the header. */
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  defaultOpen?: boolean;
  children: ReactNode;
}

// Generic accordion used to fold tall, secondary panels (setup guide, quick
// upload) behind a single compact header row so they no longer dominate the
// first scroll. Collapsed by default keeps primary content above the fold;
// every toggle is a real interactive control.
export function CollapsibleSection({
  title,
  description,
  badge,
  icon: Icon,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <Icon size={16} className="shrink-0 text-accent-gold" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
              {title}
            </span>
            {description && (
              <span className="mt-0.5 block truncate text-xs text-ink-600 dark:text-ink-300">
                {description}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown
            size={16}
            className={cn(
              "text-ink-500 transition-transform dark:text-ink-400",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open && (
        <div className="border-t border-ink-200 px-4 py-4 dark:border-ink-800">
          {children}
        </div>
      )}
    </section>
  );
}
