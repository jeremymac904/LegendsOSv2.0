import Link from "next/link";

import { CreateCalendarItem } from "@/components/calendar/CreateCalendarItem";
import {
  CalendarFilters,
  type CalendarFilter,
} from "@/components/calendar/CalendarFilters";
import {
  CalendarMonthGrid,
  type CalendarEntry,
} from "@/components/calendar/CalendarMonthGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type {
  CalendarItem,
  EmailCampaign,
  SocialPost,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: { month?: string; filter?: string; focus?: string; view?: string };
}

function normalizeMonth(input: string | undefined): string {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  if (!input) return fallback;
  return /^\d{4}-\d{2}$/.test(input) ? input : fallback;
}

function normalizeFilter(input: string | undefined): CalendarFilter {
  if (input === "social" || input === "email" || input === "cal") return input;
  return "all";
}

function normalizeView(input: string | undefined): "month" | "week" | "agenda" {
  if (input === "week" || input === "agenda") return input;
  return "month";
}

function monthBounds(month: string): { startIso: string; endIso: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, 1);
  const end = new Date(y, m || 1, 1); // first day of next month
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

  const month = normalizeMonth(searchParams?.month);
  const filter = normalizeFilter(searchParams?.filter);
  const view = normalizeView(searchParams?.view);
  // `?focus=<id>` is the deep-link target Atlas uses after creating a
  // calendar item. We only accept UUID-shaped strings so a stray param
  // can never inject anything weird into the rendered grid.
  const rawFocus = searchParams?.focus ?? "";
  const focusId =
    /^[0-9a-f-]{36}$/i.test(rawFocus) ? rawFocus : null;
  const { startIso, endIso } = monthBounds(month);

  // Pull entries that intersect the month. For the "Upcoming next 7 days" list
  // we also widen the window slightly so it still works near month edges.
  const upcomingStart = new Date().toISOString();
  const upcomingEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const wantSocial = filter === "all" || filter === "social";
  const wantEmail = filter === "all" || filter === "email";
  const wantCal = filter === "all" || filter === "cal";

  const [
    { data: calendar },
    { data: socials },
    { data: emails },
    { data: upcomingCalendar },
    { data: upcomingSocials },
    { data: upcomingEmails },
  ] = await Promise.all([
    wantCal
      ? supabase
          .from("calendar_items")
          .select("id,title,description,starts_at,item_type")
          .gte("starts_at", startIso)
          .lt("starts_at", endIso)
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [] as Partial<CalendarItem>[] }),
    wantSocial
      ? supabase
          .from("social_posts")
          .select("id,title,body,scheduled_at,status")
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", startIso)
          .lt("scheduled_at", endIso)
      : Promise.resolve({ data: [] as Partial<SocialPost>[] }),
    wantEmail
      ? supabase
          .from("email_campaigns")
          .select("id,subject,scheduled_at,status")
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", startIso)
          .lt("scheduled_at", endIso)
      : Promise.resolve({ data: [] as Partial<EmailCampaign>[] }),
    wantCal
      ? supabase
          .from("calendar_items")
          .select("id,title,starts_at")
          .gte("starts_at", upcomingStart)
          .lt("starts_at", upcomingEnd)
          .order("starts_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as Partial<CalendarItem>[] }),
    wantSocial
      ? supabase
          .from("social_posts")
          .select("id,title,scheduled_at")
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", upcomingStart)
          .lt("scheduled_at", upcomingEnd)
          .order("scheduled_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as Partial<SocialPost>[] }),
    wantEmail
      ? supabase
          .from("email_campaigns")
          .select("id,subject,scheduled_at")
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", upcomingStart)
          .lt("scheduled_at", upcomingEnd)
          .order("scheduled_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as Partial<EmailCampaign>[] }),
  ]);

  const monthEntries: CalendarEntry[] = [
    ...((calendar ?? []) as Pick<
      CalendarItem,
      "id" | "title" | "description" | "starts_at"
    >[]).map((c) => ({
      id: c.id,
      kind: "calendar" as const,
      title: c.title,
      whenIso: c.starts_at,
      link: `/calendar?month=${month}`,
    })),
    ...((socials ?? []) as Pick<
      SocialPost,
      "id" | "title" | "scheduled_at"
    >[])
      .filter((s) => s.scheduled_at)
      .map((s) => ({
        id: s.id,
        kind: "social" as const,
        title: s.title || "Social draft",
        whenIso: s.scheduled_at as string,
        link: `/social/${s.id}`,
      })),
    ...((emails ?? []) as Pick<
      EmailCampaign,
      "id" | "subject" | "scheduled_at"
    >[])
      .filter((e) => e.scheduled_at)
      .map((e) => ({
        id: e.id,
        kind: "email" as const,
        title: e.subject,
        whenIso: e.scheduled_at as string,
        link: `/email/${e.id}`,
      })),
  ];

  const upcoming: CalendarEntry[] = [
    ...((upcomingCalendar ?? []) as Pick<
      CalendarItem,
      "id" | "title" | "starts_at"
    >[]).map((c) => ({
      id: c.id,
      kind: "calendar" as const,
      title: c.title,
      whenIso: c.starts_at,
      link: `/calendar`,
    })),
    ...((upcomingSocials ?? []) as Pick<
      SocialPost,
      "id" | "title" | "scheduled_at"
    >[])
      .filter((s) => s.scheduled_at)
      .map((s) => ({
        id: s.id,
        kind: "social" as const,
        title: s.title || "Social draft",
        whenIso: s.scheduled_at as string,
        link: `/social/${s.id}`,
      })),
    ...((upcomingEmails ?? []) as Pick<
      EmailCampaign,
      "id" | "subject" | "scheduled_at"
    >[])
      .filter((e) => e.scheduled_at)
      .map((e) => ({
        id: e.id,
        kind: "email" as const,
        title: e.subject,
        whenIso: e.scheduled_at as string,
        link: `/email/${e.id}`,
      })),
  ].sort(
    (a, b) => new Date(a.whenIso).getTime() - new Date(b.whenIso).getTime()
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Calendar"
        title="Content & campaign planning"
        description="Plan campaigns across calendar items, scheduled social posts, and email sends."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CalendarViewTabs month={month} filter={filter} current={view} />
            <CalendarFilters current={filter} />
          </div>
        }
      />

      {view === "agenda" && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Agenda</h2>
              <p>Chronological planning list across social, email, and calendar items.</p>
            </div>
          </div>
          <AgendaList entries={monthEntries} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className={view === "week" ? "" : "card-padded"}>
          {view === "week" ? (
            <WeekStrip upcoming={upcoming.length > 0 ? upcoming : monthEntries} />
          ) : (
            <CalendarMonthGrid
              month={month}
              entries={monthEntries}
              focusId={focusId}
            />
          )}
        </section>

        <aside className="space-y-4">
          <WeekStrip upcoming={upcoming} />
          {upcoming.length > 0 && (
            <section className="card-padded">
              <div className="section-title">
                <div>
                  <h2>Quick links</h2>
                  <p>Jump straight into the next few items.</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {upcoming.slice(0, 4).map((row) => (
                  <Link
                    key={`${row.kind}-${row.id}`}
                    href={row.link}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3 hover:border-accent-gold/30 hover:bg-ink-900/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-100">
                        {row.title}
                      </p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-ink-400">
                        {formatDate(row.whenIso)} · {row.kind}
                      </p>
                    </div>
                    <span
                      className={
                        row.kind === "social"
                          ? "chip border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
                          : row.kind === "email"
                          ? "chip border-accent-gold/50 bg-accent-gold/15 text-accent-gold"
                          : "chip"
                      }
                    >
                      {row.kind}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <CreateCalendarItem
            userId={profile.id}
            organizationId={profile.organization_id}
          />
        </aside>
      </div>
    </div>
  );
}

function CalendarViewTabs({
  month,
  filter,
  current,
}: {
  month: string;
  filter: CalendarFilter;
  current: "month" | "week" | "agenda";
}) {
  return (
    <div className="flex rounded-xl border border-ink-800 bg-ink-900/50 p-1">
      {(["month", "week", "agenda"] as const).map((view) => (
        <Link
          key={view}
          href={`/calendar?month=${month}&filter=${filter}&view=${view}`}
          className={[
            "rounded-lg px-2.5 py-1 text-[11px] capitalize transition",
            current === view
              ? "bg-accent-gold/15 text-accent-gold"
              : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
          ].join(" ")}
        >
          {view}
        </Link>
      ))}
    </div>
  );
}

function AgendaList({ entries }: { entries: CalendarEntry[] }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.whenIso).getTime() - new Date(b.whenIso).getTime()
  );
  if (sorted.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-ink-700 bg-ink-900/30 p-4 text-sm text-ink-300">
        No items in this month. Create a calendar item or schedule a campaign to fill the agenda.
      </p>
    );
  }
  return (
    <div className="mt-3 grid gap-2">
      {sorted.map((entry) => (
        <Link
          key={`${entry.kind}-${entry.id}`}
          href={entry.link}
          className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3 hover:border-accent-gold/30"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-100">
              {entry.title}
            </p>
            <p className="text-xs text-ink-300">{formatDate(entry.whenIso)}</p>
          </div>
          <span className="chip">{entry.kind}</span>
        </Link>
      ))}
    </div>
  );
}

// Server-rendered week strip — surfaces all 7 upcoming days (incl. today)
// as their own row even when empty, so it reads as a true "week view"
// rather than a flat top-N list. Items on the same day stack inside the
// same row, sorted by time. Today's row is ringed in gold.
function WeekStrip({ upcoming }: { upcoming: CalendarEntry[] }) {
  const today = new Date();
  // Build 7 day buckets starting from today's local midnight.
  const buckets: { date: Date; key: string; entries: CalendarEntry[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + i
    );
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    buckets.push({ date: d, key, entries: [] });
  }
  for (const e of upcoming) {
    const d = new Date(e.whenIso);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    const slot = buckets.find((b) => b.key === key);
    if (slot) slot.entries.push(e);
  }
  for (const b of buckets) {
    b.entries.sort(
      (a, b2) => new Date(a.whenIso).getTime() - new Date(b2.whenIso).getTime()
    );
  }
  const todayKey = buckets[0].key;

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>This week</h2>
          <p>Day-by-day view of the next 7 days.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {buckets.map((b) => {
          const isToday = b.key === todayKey;
          const weekday = b.date.toLocaleDateString(undefined, {
            weekday: "short",
          });
          const day = b.date.getDate();
          return (
            <div
              key={b.key}
              className={[
                "rounded-xl border bg-ink-900/40 p-2.5",
                isToday
                  ? "border-accent-gold/40 ring-1 ring-inset ring-accent-gold/25"
                  : "border-ink-800",
              ].join(" ")}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p
                  className={[
                    "text-[10px] font-semibold uppercase tracking-[0.18em]",
                    isToday ? "text-accent-gold" : "text-ink-300",
                  ].join(" ")}
                >
                  {isToday ? "Today" : weekday}{" "}
                  <span
                    className={[
                      "ml-0.5 font-normal tabular-nums",
                      isToday ? "text-accent-gold" : "text-ink-400",
                    ].join(" ")}
                  >
                    {day}
                  </span>
                </p>
                {b.entries.length > 0 && (
                  <span className="text-[9.5px] uppercase tracking-[0.18em] text-ink-500">
                    {b.entries.length} item
                    {b.entries.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {b.entries.length === 0 ? (
                <p className="text-[11px] italic text-ink-500">No items</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {b.entries.map((row) => (
                    <Link
                      key={`${row.kind}-${row.id}`}
                      href={row.link}
                      className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-ink-800/70"
                    >
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-100">
                        {new Date(row.whenIso).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        — {row.title}
                      </span>
                      <span
                        className={[
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          row.kind === "social"
                            ? "bg-accent-gold/60"
                            : row.kind === "email"
                            ? "bg-accent-gold/80"
                            : "bg-accent-gold/30",
                        ].join(" ")}
                        title={row.kind}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
