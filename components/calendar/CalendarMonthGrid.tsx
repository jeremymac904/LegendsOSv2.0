"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

export type CalendarKind = "social" | "email" | "calendar";

export interface CalendarEntry {
  id: string;
  kind: CalendarKind;
  title: string;
  /** ISO string, computed server-side */
  whenIso: string;
  link: string;
  /**
   * Calendar-item-only extras used by the detail popover. Social/email
   * entries leave these undefined — they link out to their own studios.
   */
  description?: string | null;
  itemType?: string | null;
}

// Human-readable label for a `calendar_items.item_type` enum value.
function itemTypeLabel(itemType: string | null | undefined): string {
  switch (itemType) {
    case "content_plan":
      return "Content plan";
    case "social_post":
      return "Social post";
    case "email_campaign":
      return "Email campaign";
    case "team_event":
      return "Team event";
    case "reminder":
      return "Reminder";
    default:
      return "Calendar item";
  }
}

interface Props {
  /** YYYY-MM of the currently visible month */
  month: string;
  entries: CalendarEntry[];
  /**
   * Optional entry id to highlight + scroll-into-view. Driven by the
   * `?focus=<uuid>` query param, used by Atlas after creating a calendar
   * item so the user can immediately see what was added.
   */
  focusId?: string | null;
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

// Each calendar kind gets a subtle gold-family chip. We previously used
// accent-orange for the "social" kind, but the design system is gold-only;
// orange is reserved for the Facebook brand chip in PostPreview (owned by
// another agent). Here we use a warmer gold tint for social and the standard
// gold for email so they're distinguishable without leaving the gold family.
function kindClasses(kind: CalendarKind): string {
  switch (kind) {
    case "social":
      return "border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20";
    case "email":
      return "border-accent-gold/50 bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25";
    case "calendar":
    default:
      // `bg-ink-800/80` is light-remapped globally; the hover fill is not, so
      // pin it to a light-safe surface explicitly via the dual pattern.
      return "border-ink-600/70 bg-ink-800/80 text-ink-900 dark:text-ink-100 border-l-2 border-l-accent-gold/60 hover:bg-ink-100 dark:hover:bg-ink-700/80";
  }
}

export function CalendarMonthGrid({ month, entries, focusId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // The calendar entry whose detail popover is open, plus the on-screen rect of
  // the chip that triggered it so the portal-rendered popover can anchor itself
  // with `fixed` positioning (immune to the grid's `overflow-hidden`). Only
  // `calendar` entries open a popover — social/email link out to their studios.
  const [open, setOpen] = useState<{
    id: string;
    rect: { top: number; bottom: number; left: number; right: number };
  } | null>(null);
  const openId = open?.id ?? null;
  const closePopover = () => setOpen(null);
  // Holds the DOM node for the focused entry so we can scroll it into view.
  // We keep the highlight active for ~3s, then fade so the rest of the
  // calendar reads normally on a manual revisit. The focus target is always a
  // calendar entry, which renders as a <button>.
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const [highlightActive, setHighlightActive] = useState<boolean>(
    Boolean(focusId)
  );
  useEffect(() => {
    if (!focusId) return;
    setHighlightActive(true);
    // Scroll into view in the next paint so the DOM is settled.
    const id = window.requestAnimationFrame(() => {
      focusRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    const t = window.setTimeout(() => setHighlightActive(false), 3000);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [focusId]);

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

  // The full entry whose popover is open (resolved from the open id). Guarded so
  // a stale id (e.g. after the data refreshes) simply renders nothing.
  const openEntry = openId
    ? entries.find((e) => e.id === openId && e.kind === "calendar") ?? null
    : null;

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

  // Close the open popover on Escape, or when the page scrolls/resizes (so the
  // fixed-positioned popover never floats away from its anchor chip).
  useEffect(() => {
    if (!openId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    function onMove() {
      setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [openId]);

  // Calendar-item delete. Social + email drafts have their own delete flows in
  // their respective studios; this only runs for `calendar` entries. The
  // request hits /api/calendar/:id which performs a real RLS-scoped Supabase
  // delete (no migration involved).
  async function deleteCalendarItem(id: string, title: string) {
    if (deletingId) return;
    if (!window.confirm(`Delete "${title || "Untitled"}" from the calendar?`))
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = "Could not delete that item.";
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          /* non-JSON error body — keep the generic message */
        }
        window.alert(message);
        return;
      }
      setOpen(null);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
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
            <span className="inline-block h-2 w-2 rounded-full bg-accent-gold/50" />
            Social
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-gold/80" />
            Email
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border-l-2 border-l-accent-gold/70 bg-ink-200 dark:bg-ink-700" />
            Item
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-200/60 dark:bg-ink-700/40">
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
                "relative flex min-h-[104px] flex-col gap-1 p-1.5 transition-colors lg:min-h-[118px] xl:min-h-[132px]",
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
                {visible.map((entry) => {
                  const isCalendar = entry.kind === "calendar";
                  const isDeleting = deletingId === entry.id;
                  const isOpen = openId === entry.id;
                  const isFocused =
                    !!focusId && isCalendar && entry.id === focusId;
                  const chipClass = [
                    "block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[10.5px] font-medium leading-tight transition-shadow",
                    isCalendar ? "pr-4" : "",
                    kindClasses(entry.kind),
                    isDeleting ? "opacity-50" : "",
                    isFocused && highlightActive
                      ? "ring-2 ring-accent-gold/80 shadow-[0_0_0_3px_rgba(216,179,90,0.18)]"
                      : "",
                  ].join(" ");
                  const chipTitle = `${entry.title} — ${new Date(
                    entry.whenIso
                  ).toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`;
                  return (
                    <div
                      key={`${entry.kind}-${entry.id}`}
                      className="group relative"
                    >
                      {isCalendar ? (
                        // Calendar items open an in-place detail popover (real
                        // detail + delete) instead of a dead self-link.
                        <button
                          type="button"
                          ref={isFocused ? focusRef : null}
                          onClick={(e) => {
                            if (openId === entry.id) {
                              setOpen(null);
                              return;
                            }
                            const r =
                              e.currentTarget.getBoundingClientRect();
                            setOpen({
                              id: entry.id,
                              rect: {
                                top: r.top,
                                bottom: r.bottom,
                                left: r.left,
                                right: r.right,
                              },
                            });
                          }}
                          title={chipTitle}
                          aria-haspopup="dialog"
                          aria-expanded={isOpen}
                          className={chipClass}
                          data-focused={isFocused ? "true" : undefined}
                        >
                          {entry.title || "Untitled"}
                        </button>
                      ) : (
                        <Link
                          href={entry.link}
                          title={chipTitle}
                          className={chipClass}
                        >
                          {entry.title || "Untitled"}
                        </Link>
                      )}
                      {isCalendar && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void deleteCalendarItem(entry.id, entry.title);
                          }}
                          disabled={isDeleting}
                          aria-label="Delete calendar item"
                          className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-0.5 text-ink-600 shadow-sm transition hover:bg-status-err/20 hover:text-status-err group-hover:flex dark:bg-ink-950/80 dark:text-ink-300"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <span className="inline-flex w-fit items-center rounded-full border border-ink-700 bg-ink-800/80 px-1.5 py-[1px] text-[9.5px] font-medium text-ink-700 dark:text-ink-300">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openEntry && open && (
        <CalendarItemPopover
          entry={openEntry}
          anchor={open.rect}
          isDeleting={deletingId === openEntry.id}
          onClose={closePopover}
          onDelete={() => void deleteCalendarItem(openEntry.id, openEntry.title)}
        />
      )}
    </div>
  );
}

// Detail popover for a single calendar item. Shows the real stored detail
// (type, full date/time, description) and exposes a working delete. Rendered
// in a portal with `fixed` positioning anchored to the trigger chip's rect, so
// the grid's `overflow-hidden` can never clip it. A full-screen transparent
// backdrop closes it on outside click. Surfaces use dual light/dark classes
// because the popover must read on both pure white and the dark canvas.
function CalendarItemPopover({
  entry,
  anchor,
  isDeleting,
  onClose,
  onDelete,
}: {
  entry: CalendarEntry;
  anchor: { top: number; bottom: number; left: number; right: number };
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Portals only exist client-side; gate the render until after mount so SSR
  // never touches `document`. The positioning effect depends on `mounted` so it
  // re-measures once the card node actually exists.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Position after layout so we can measure the card's real size and flip /
  // clamp it inside the viewport.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const margin = 8;
    const { innerWidth, innerHeight } = window;
    const rect = el.getBoundingClientRect();
    const w = rect.width || 240;
    const h = rect.height || 160;
    // Horizontal: align to the chip's left edge, clamped to the viewport.
    let left = anchor.left;
    if (left + w + margin > innerWidth) left = innerWidth - w - margin;
    if (left < margin) left = margin;
    // Vertical: prefer below the chip; flip above if it would overflow.
    let top = anchor.bottom + 4;
    if (top + h + margin > innerHeight) {
      const above = anchor.top - h - 4;
      top = above >= margin ? above : Math.max(margin, innerHeight - h - margin);
    }
    setPos({ left, top });
  }, [anchor, mounted]);

  const when = new Date(entry.whenIso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const description = entry.description?.trim();

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Click-outside backdrop. Transparent; just captures the dismiss. */}
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className="fixed inset-0 z-[60] cursor-default"
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`${entry.title || "Untitled"} details`}
        style={{
          left: pos?.left ?? anchor.left,
          top: pos?.top ?? anchor.bottom + 4,
          visibility: pos ? "visible" : "hidden",
        }}
        className="fixed z-[61] w-[240px] max-w-[calc(100vw-16px)] rounded-xl border border-ink-200 bg-white p-3 text-left shadow-xl dark:border-ink-700 dark:bg-ink-900"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-gold">
            {itemTypeLabel(entry.itemType)}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-0.5 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            <X size={13} />
          </button>
        </div>
        <p className="mt-1 break-words text-sm font-semibold leading-snug text-ink-900 dark:text-ink-100">
          {entry.title || "Untitled"}
        </p>
        <p className="mt-1 text-[11px] text-ink-700 dark:text-ink-300">{when}</p>
        {description ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-700 dark:text-ink-300">
            {description}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-ink-600 dark:text-ink-400">
            No description.
          </p>
        )}
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-ink-200 pt-2 dark:border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-700 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1 rounded-lg border border-status-err/40 bg-status-err/10 px-2.5 py-1 text-[11px] font-semibold text-status-err transition hover:bg-status-err/20 disabled:opacity-50"
          >
            <Trash2 size={12} />
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
