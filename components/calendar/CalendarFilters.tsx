"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "social", label: "Social" },
  { value: "email", label: "Email" },
  { value: "cal", label: "Calendar" },
] as const;

type Filter = (typeof OPTIONS)[number]["value"];

interface Props {
  current: Filter;
}

export function CalendarFilters({ current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setFilter(next: Filter) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (next === "all") sp.delete("filter");
    else sp.set("filter", next);
    const q = sp.toString();
    startTransition(() => {
      router.replace(q ? `${pathname}?${q}` : pathname);
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Calendar filter"
      data-pending={isPending || undefined}
    >
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setFilter(opt.value)}
            className={
              active
                ? "inline-flex items-center gap-1 rounded-full border border-accent-gold/40 bg-gradient-to-br from-accent-gold/25 to-accent-gold/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-gold shadow-glow"
                : "inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-300 hover:border-ink-600 hover:text-ink-100"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export type CalendarFilter = Filter;
