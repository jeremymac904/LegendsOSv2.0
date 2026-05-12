import { Calendar as CalendarIcon } from "lucide-react";

import { CreateCalendarItem } from "@/components/calendar/CreateCalendarItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type {
  CalendarItem,
  EmailCampaign,
  SocialPost,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  title: string;
  source: "calendar" | "social" | "email";
  starts_at: string;
  status?: string;
  description?: string | null;
  related_id?: string;
}

export default async function CalendarPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 1).toISOString();

  const [{ data: calendar }, { data: socials }, { data: emails }] =
    await Promise.all([
      supabase
        .from("calendar_items")
        .select("*")
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at", { ascending: true }),
      supabase
        .from("social_posts")
        .select("id,title,body,scheduled_at,status")
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end),
      supabase
        .from("email_campaigns")
        .select("id,subject,scheduled_at,status")
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end),
    ]);

  const merged: Row[] = [
    ...((calendar ?? []) as CalendarItem[]).map((c) => ({
      id: c.id,
      title: c.title,
      source: "calendar" as const,
      starts_at: c.starts_at,
      description: c.description,
    })),
    ...((socials ?? []) as Pick<
      SocialPost,
      "id" | "title" | "body" | "scheduled_at" | "status"
    >[])
      .filter((s) => s.scheduled_at)
      .map((s) => ({
        id: s.id,
        title: s.title ?? "Social draft",
        description: s.body,
        source: "social" as const,
        starts_at: s.scheduled_at!,
        status: s.status,
        related_id: s.id,
      })),
    ...((emails ?? []) as Pick<
      EmailCampaign,
      "id" | "subject" | "scheduled_at" | "status"
    >[])
      .filter((e) => e.scheduled_at)
      .map((e) => ({
        id: e.id,
        title: e.subject,
        source: "email" as const,
        starts_at: e.scheduled_at!,
        status: e.status,
        related_id: e.id,
      })),
  ].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Calendar"
        title="Content & campaign planning"
        description="Two-month view across calendar items, scheduled social posts, and email campaigns."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>This and next month</h2>
              <p>All times in your local timezone.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {merged.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="Nothing scheduled"
                description="Create a planning item on the right, or schedule a social post / email."
              />
            ) : (
              merged.map((row) => (
                <article
                  key={`${row.source}-${row.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-100">
                      {row.title}
                    </p>
                    {row.description && (
                      <p className="line-clamp-2 text-xs text-ink-300">
                        {row.description}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-400">
                      {formatDate(row.starts_at)} · {row.source}
                    </p>
                  </div>
                  {row.status && <StatusPill status={row.status as never} />}
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <CreateCalendarItem
            userId={profile.id}
            organizationId={profile.organization_id}
          />
        </aside>
      </div>
    </div>
  );
}
