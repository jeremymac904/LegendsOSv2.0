"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useTransition } from "react";

export type CalendarKind = "social" | "email" | "calendar";

export interface CalendarEntry {
  id: string;
  kind: CalendarKind;
  title: string;
  /** ISO string, computed server-side */
  whenIso: string;
  link: string;
}

interface Props {
  /** YYYY-MM of the currently visible month */
  month: string;
  entries: CalendarEntry[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonth(month: string): { year: number; month0: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y, month0: (m || 1) - 1 };
}

function shiftMonth(month: string, delta: number): string {
  const { year, month0 } = parseMonth(month);
  const d = new Date(year, month0 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const { year, month0 } = parseMonth(month);
  return new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function kindClasses(kind: CalendarKind): string {
  switch (kind) {
    case "social":
      return "border-accent-orange/40 bg-accent-orange/15 text-accent-orange hover:bg-accent-orange/25";
    case "email":
      return "border-accent-gold/40 bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25";
    case "calendar":
    default:
      return "border-ink-600/70 bg-ink-800/80 text-ink-100 border-l-2 border-l-accent-gold/60 hover:bg-ink-700/80";
  }
}

export function CalendarMonthGrid({ month, entries }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const { year, month0 } = parseMonth(month);

  // Build the 6-week grid covering this month.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month0, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sun
    const gridStart = new Date(year, month0, 1 - startWeekday);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(d);
    }
    // Trim to 5 rows if the last row is entirely in the next month.
    const lastRowStart = out[35];
    if (lastRowStart && lastRowStart.getMonth() !== month0) {
      return out.slice(0, 35);
    }
    return out;
  }, [year, month0]);

  // Group entries by YYYY-MM-DD in local time.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const d = new Date(e.whenIso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) => new Date(a.whenIso).getTime() - new Date(b.whenIso).getTime()
      );
    }
    return map;
  }, [entries]);

  function go(deltaMonths: number) {
    const next = shiftMonth(month, deltaMonths);
    const sp = new URLSearchParams(params?.toString() ?? "");
    sp.set("month", next);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`);
    });
  }

  function goToday() {
    const now = new Date();
    const next = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const sp = new URLSearchParams(params?.toString() ?? "");
    sp.set("month", next);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`);
    });
  }

  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="space-y-3" data-pending={isPending || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="btn-ghost h-8 px-2"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="min-w-[10ch] text-base font-semibold tracking-tight text-ink-100">
            {monthLabel(month)}
          </h2>
          <button
            type="button"
            onClick={() => go(1)}
            className="btn-ghost h-8 px-2"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="btn-ghost h-8 px-3 text-xs uppercase tracking-wider"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-300">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-orange/70" />
            Social
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-gold/80" />
            Email
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border-l-2 border-l-accent-gold/70 bg-ink-700" />
            Item
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-700/40">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="bg-ink-900/80 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400"
          >
            {d}
          </div>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === month0;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}-${String(d.getDate()).padStart(2, "0")}`;
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const visible = items.slice(0, 3);
          const overflow = items.length - visible.length;

          return (
            <div
              key={key}
              className={[
                "relative flex min-h-[96px] flex-col gap-1 p-1.5 transition-colors",
                inMonth ? "bg-ink-900/60" : "bg-ink-900/20",
                isToday
                  ? "ring-1 ring-inset ring-accent-gold/50 bg-accent-gold/[0.06]"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span
                  className={[
                    "text-[11px] font-semibold tabular-nums",
                    inMonth ? "text-ink-200" : "text-ink-500",
                    isToday ? "text-accent-gold" : "",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="text-[9px] uppercase tracking-wider text-ink-400">
                    {items.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {visible.map((entry) => (
                  <Link
                    key={`${entry.kind}-${entry.id}`}
                    href={entry.link}
                    title={`${entry.title} — ${new Date(
                      entry.whenIso
                    ).toLocaleString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
                    className={[
                      "block truncate rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium leading-tight",
                      kindClasses(entry.kind),
                    ].join(" ")}
                  >
                    {entry.title || "Untitled"}
                  </Link>
                ))}
                {overflow > 0 && (
                  <span className="inline-flex w-fit items-center rounded-full border border-ink-700 bg-ink-800/80 px-1.5 py-[1px] text-[9.5px] font-medium text-ink-300">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
