import { Calendar as CalendarIcon } from "lucide-react";
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
import { EmptyState } from "@/components/ui/EmptyState";
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
  searchParams?: { month?: string; filter?: string };
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
        action={<CalendarFilters current={filter} />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <CalendarMonthGrid month={month} entries={monthEntries} />
        </section>

        <aside className="space-y-4">
          <section className="card-padded">
            <div className="section-title">
              <div>
                <h2>Next 7 days</h2>
                <p>Flat view for quick planning.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarIcon}
                  title="Nothing in the next week"
                  description="Schedule a post, queue an email, or add a planning item."
                />
              ) : (
                upcoming.slice(0, 6).map((row) => (
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
                          ? "chip border-accent-orange/40 bg-accent-orange/10 text-accent-orange"
                          : row.kind === "email"
                          ? "chip border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                          : "chip"
                      }
                    >
                      {row.kind}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>

          <CreateCalendarItem
            userId={profile.id}
            organizationId={profile.organization_id}
          />
        </aside>
      </div>
    </div>
  );
}
