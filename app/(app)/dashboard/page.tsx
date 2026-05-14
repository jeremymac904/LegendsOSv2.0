import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  ImageIcon,
  Mail,
  MessageCircle,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { imageLibrary } from "@/lib/assets";
import { renderEmailPreview } from "@/lib/email/render";
import { PUBLIC_ENV, getServerEnv } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type {
  AutomationJob,
  EmailCampaign,
  GeneratedMedia,
  SocialPost,
  UsageEvent,
} from "@/types/database";

export const dynamic = "force-dynamic";

const QUICK_LAUNCH = [
  {
    href: "/atlas",
    label: "Open Atlas Chat",
    description: "Start a new conversation with your assistant.",
    icon: MessageCircle,
  },
  {
    href: "/images",
    label: "Generate an Image",
    description: "Spin up a marketing image with Fal.ai.",
    icon: ImageIcon,
  },
  {
    href: "/social",
    label: "Draft a Post",
    description: "Multi-channel social draft with media.",
    icon: Share2,
  },
  {
    href: "/email",
    label: "Compose Newsletter",
    description: "Email Studio drafts that always save.",
    icon: Mail,
  },
  {
    href: "/calendar",
    label: "Plan Content",
    description: "Schedule posts and campaigns.",
    icon: Calendar,
  },
  {
    href: "/knowledge",
    label: "Add Knowledge",
    description: "Upload reference material for Atlas.",
    icon: BookOpen,
  },
];

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const next7DaysIso = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Recent-chats card + Provider-status card were removed per the
  // walkthrough. We now skip those reads on the dashboard.
  const [
    { data: socialDrafts },
    { data: emailDrafts },
    { data: media },
    { data: usage24h },
    { data: recentJobs },
    { data: latestNewsletterRow },
    { data: upcomingSocial },
    { data: upcomingEmail },
    { data: upcomingCalendar },
  ] = await Promise.all([
    supabase
      .from("social_posts")
      .select("id,title,body,channels,status,scheduled_at,updated_at")
      .in("status", ["draft", "scheduled"])
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("email_campaigns")
      .select("id,subject,status,scheduled_at,updated_at")
      .in("status", ["draft", "approved"])
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("generated_media")
      .select("id,prompt,preview_url,status,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("usage_events")
      .select("module,event_type,created_at")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("automation_jobs")
      .select("id,job_type,status,updated_at,last_error")
      .order("updated_at", { ascending: false })
      .limit(5),
    // Most recent email campaign of any status — drives the new "Latest
    // newsletter" card. We render its inbox preview via lib/email/render.ts
    // so the dashboard mirrors what the composer / future n8n payload show.
    supabase
      .from("email_campaigns")
      .select("id,subject,preview_text,body_text,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Upcoming-content reads — next 7 days, scheduled rows only.
    supabase
      .from("social_posts")
      .select("id,title,scheduled_at,status,channels")
      .gte("scheduled_at", nowIso)
      .lte("scheduled_at", next7DaysIso)
      .order("scheduled_at", { ascending: true })
      .limit(10),
    supabase
      .from("email_campaigns")
      .select("id,subject,scheduled_at,status")
      .gte("scheduled_at", nowIso)
      .lte("scheduled_at", next7DaysIso)
      .order("scheduled_at", { ascending: true })
      .limit(10),
    supabase
      .from("calendar_items")
      .select("id,title,starts_at,item_type")
      .gte("starts_at", nowIso)
      .lte("starts_at", next7DaysIso)
      .order("starts_at", { ascending: true })
      .limit(10),
  ]);

  const drafts = (socialDrafts ?? []) as Pick<
    SocialPost,
    "id" | "title" | "body" | "channels" | "status" | "scheduled_at" | "updated_at"
  >[];
  const emails = (emailDrafts ?? []) as Pick<
    EmailCampaign,
    "id" | "subject" | "status" | "scheduled_at" | "updated_at"
  >[];
  const images = (media ?? []) as Pick<
    GeneratedMedia,
    "id" | "prompt" | "preview_url" | "status" | "created_at"
  >[];
  const events = (usage24h ?? []) as Pick<
    UsageEvent,
    "module" | "event_type" | "created_at"
  >[];
  const jobs = (recentJobs ?? []) as Pick<
    AutomationJob,
    "id" | "job_type" | "status" | "updated_at" | "last_error"
  >[];

  const owner = isOwner(profile);

  // Daily caps come from server env. Used to render "X chats remaining today"
  // copy on the stat cards instead of bare 0/N.
  const env = getServerEnv();
  const caps = env.DAILY_CAPS;
  const chatsUsed = events.filter((e) => e.module === "atlas").length;
  const imagesUsed = events.filter((e) => e.module === "images").length;
  const socialUsed = events.filter((e) => e.module === "social").length;
  const emailUsed = events.filter((e) => e.module === "email").length;

  // When the image library is essentially empty, surface the brand visuals
  // from the asset manifest so the "Recent imagery" card never looks dead.
  // Owner-only assets are filtered to team_shared for non-owners.
  const brandStarters = imageLibrary()
    .filter((a) => owner || a.default_visibility === "team_shared")
    .filter(
      (a) =>
        a.category === "social_image" ||
        a.category === "image_studio_reference" ||
        a.category === "background"
    )
    .slice(0, 6);

  // Latest newsletter — render its inbox preview through the shared shell
  // so the dashboard mirrors the composer + future n8n payload.
  const latestNewsletter = latestNewsletterRow
    ? (latestNewsletterRow as Pick<
        EmailCampaign,
        "id" | "subject" | "preview_text" | "body_text" | "status" | "updated_at"
      >)
    : null;
  const latestNewsletterHtml = latestNewsletter
    ? renderEmailPreview({
        subject: latestNewsletter.subject || "(No subject)",
        previewText: latestNewsletter.preview_text ?? "",
        bodyMarkdown: latestNewsletter.body_text ?? "",
      }).html
    : "";

  // Upcoming content (next 7 days) — merged feed across social, email, calendar.
  type UpcomingItem = {
    id: string;
    kind: "social" | "email" | "calendar";
    title: string;
    whenIso: string;
    href: string;
    badge?: string;
  };
  const upcoming: UpcomingItem[] = [
    ...((upcomingSocial ?? []) as Array<{
      id: string;
      title: string | null;
      scheduled_at: string;
      status: string;
      channels?: string[] | null;
    }>).map((s) => ({
      id: s.id,
      kind: "social" as const,
      title: s.title || "Untitled social post",
      whenIso: s.scheduled_at,
      href: `/social/${s.id}`,
      badge: s.channels?.[0]?.replace(/_/g, " "),
    })),
    ...((upcomingEmail ?? []) as Array<{
      id: string;
      subject: string | null;
      scheduled_at: string;
      status: string;
    }>).map((e) => ({
      id: e.id,
      kind: "email" as const,
      title: e.subject || "Untitled newsletter",
      whenIso: e.scheduled_at,
      href: `/email/${e.id}`,
      badge: e.status,
    })),
    ...((upcomingCalendar ?? []) as Array<{
      id: string;
      title: string | null;
      starts_at: string;
      item_type: string;
    }>).map((c) => ({
      id: c.id,
      kind: "calendar" as const,
      title: c.title || "Untitled event",
      whenIso: c.starts_at,
      href: `/calendar?month=${c.starts_at.slice(0, 7)}`,
      badge: c.item_type.replace(/_/g, " "),
    })),
  ]
    .sort((a, b) => a.whenIso.localeCompare(b.whenIso))
    .slice(0, 6);

  // Recent activity — most recent usage events, human-labeled. Limit to last
  // 10 so the card doesn't get crowded. The 24h window is already captured.
  const activityRows = events.slice(0, 10);
  const moduleLabel: Record<string, string> = {
    atlas: "Atlas",
    images: "Image Studio",
    social: "Social Studio",
    email: "Email Studio",
    knowledge: "Knowledge",
    admin: "Admin",
  };
  const eventLabel: Record<string, string> = {
    chat_message: "sent a chat",
    image_generated: "generated an image",
    social_drafted: "drafted a post",
    social_published: "published a post",
    email_drafted: "drafted a newsletter",
    email_sent: "sent a newsletter",
    tool_call: "ran an Atlas tool",
    asset_uploaded: "uploaded an asset",
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={owner ? "Owner view" : "Operator view"}
        title={`Welcome back${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.`}
        description={`${PUBLIC_ENV.TEAM_NAME}. This is your command center — one app, one login, one source of truth.`}
        action={
          <Link href="/atlas" className="btn-primary">
            <MessageCircle size={14} />
            Start Atlas chat
          </Link>
        }
      />

      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <UsageCard
            label="Atlas chats today"
            used={chatsUsed}
            cap={caps.chat}
            unit="chat"
            icon={MessageCircle}
          />
          <UsageCard
            label="Images today"
            used={imagesUsed}
            cap={caps.images}
            unit="image"
            icon={ImageIcon}
          />
          <UsageCard
            label="Social activity today"
            used={socialUsed}
            cap={caps.social}
            unit="action"
            icon={Share2}
          />
          <UsageCard
            label="Email activity today"
            used={emailUsed}
            cap={caps.email}
            unit="action"
            icon={Mail}
          />
        </div>
      </section>

      <section>
        <div className="section-title mb-3">
          <div>
            <h2>Quick launch</h2>
            <p>Jump into the highest-value workflows.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LAUNCH.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="card-padded group transition hover:border-accent-gold/30 hover:shadow-glow"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-orange/40 to-accent-gold/30 text-accent-gold">
                  <Icon size={16} />
                </div>
                <ArrowRight
                  size={14}
                  className="text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-accent-gold"
                />
              </div>
              <p className="mt-3 font-medium text-ink-100">{label}</p>
              <p className="text-xs text-ink-300">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Drafts needing attention</h2>
              <p>Social posts and email campaigns in progress.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {drafts.length === 0 && emails.length === 0 ? (
              <EmptyState
                icon={Share2}
                title="No drafts yet"
                description="Create a social post or newsletter — drafts stay here until you approve."
              />
            ) : (
              <>
                {drafts.map((d) => (
                  <Link
                    key={d.id}
                    href={`/social/${d.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-100">
                        {d.title || "Untitled social draft"}
                      </p>
                      <p className="line-clamp-1 text-xs text-ink-300">
                        {d.body}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.channels?.map((ch) => (
                          <span key={ch} className="chip">
                            {ch.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <StatusPill status={d.status as never} />
                  </Link>
                ))}
                {emails.map((e) => (
                  <Link
                    key={e.id}
                    href={`/email/${e.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-100">
                        {e.subject || "Untitled email draft"}
                      </p>
                      <p className="text-xs text-ink-300">
                        Updated {formatRelative(e.updated_at)}
                      </p>
                    </div>
                    <StatusPill status={e.status as never} />
                  </Link>
                ))}
              </>
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>{images.length > 0 ? "Recent imagery" : "Brand visuals"}</h2>
              <p>
                {images.length > 0
                  ? "Last six Image Studio outputs."
                  : "Curated starters from your brand library — generate a new image to replace these."}
              </p>
            </div>
            <Link href="/images" className="btn-ghost text-xs">
              Open studio
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {images.length > 0
              ? images.map((img) => (
                  <div
                    key={img.id}
                    className="aspect-square overflow-hidden rounded-xl border border-ink-800 bg-checker"
                    title={img.prompt}
                  >
                    {img.preview_url ? (
                      <img
                        src={img.preview_url}
                        alt={img.prompt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] text-ink-300">
                        {img.status}
                      </div>
                    )}
                  </div>
                ))
              : brandStarters.length > 0
              ? brandStarters.map((a) => (
                  <div
                    key={a.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-ink-800 bg-checker"
                    title={a.label}
                  >
                    {a.public_path && (
                      <img
                        src={a.public_path}
                        alt={a.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <span className="absolute bottom-1 left-1 right-1 rounded-md bg-ink-950/70 px-1.5 py-0.5 text-[9px] text-ink-100 line-clamp-1">
                      {a.label}
                    </span>
                  </div>
                ))
              : (
                <div className="col-span-3">
                  <EmptyState
                    icon={Sparkles}
                    title="No imagery yet"
                    description="Open Image Studio to generate the first brand visual, or upload assets in the Admin Asset Library."
                  />
                </div>
              )}
          </div>
        </section>
      </div>

      {latestNewsletter && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Latest newsletter</h2>
              <p>
                {`"${latestNewsletter.subject || "(No subject)"}" · ${
                  latestNewsletter.status
                } · updated ${formatRelative(latestNewsletter.updated_at)}`}
              </p>
            </div>
            <Link
              href={`/email?id=${latestNewsletter.id}`}
              className="btn-primary text-xs"
            >
              <Mail size={14} />
              Continue editing
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-800 bg-ink-950">
            <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Inbox preview
              </p>
              <p className="text-[10px] text-ink-400">
                Same shell ships when n8n relays
              </p>
            </div>
            <iframe
              title="Latest newsletter preview"
              srcDoc={latestNewsletterHtml}
              sandbox=""
              className="block h-[320px] w-full bg-ink-950"
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Upcoming content</h2>
              <p>Next 7 days of scheduled posts, newsletters, and calendar items.</p>
            </div>
            <Link href="/calendar" className="btn-ghost text-xs">
              <Calendar size={14} />
              Open calendar
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nothing scheduled this week"
                description="Schedule a social post, newsletter, or calendar item to see it here."
              />
            ) : (
              upcoming.map((u) => (
                <Link
                  key={`${u.kind}-${u.id}`}
                  href={u.href}
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3 transition hover:border-accent-gold/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-100">
                      {u.title}
                    </p>
                    <p className="text-xs text-ink-300">
                      {formatRelative(u.whenIso)}
                      {u.badge ? <> · <span className="capitalize">{u.badge}</span></> : null}
                    </p>
                  </div>
                  <span
                    className={
                      u.kind === "social"
                        ? "chip border-accent-orange/40 text-accent-orange"
                        : u.kind === "email"
                        ? "chip border-accent-gold/40 text-accent-gold"
                        : "chip"
                    }
                  >
                    {u.kind}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent activity</h2>
              <p>What you and the team have been doing in the last 24 hours.</p>
            </div>
            {owner && (
              <Link href="/admin/usage" className="btn-ghost text-xs">
                <Activity size={14} />
                Full feed
              </Link>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {activityRows.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet today"
                description="Send an Atlas chat, draft a post, or generate an image — events land here."
              />
            ) : (
              activityRows.map((ev, i) => (
                <div
                  key={`${ev.created_at}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink-100">
                      <span className="text-ink-300">
                        {moduleLabel[ev.module] ?? ev.module}
                      </span>{" "}
                      {eventLabel[ev.event_type] ?? ev.event_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-ink-300">
                      {formatRelative(ev.created_at)}
                    </p>
                  </div>
                  <span className="chip">{ev.module}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {owner && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Automation jobs</h2>
              <p>n8n queue status — owner-only summary.</p>
            </div>
            <Link href="/admin/usage" className="btn-ghost text-xs">
              <TrendingUp size={14} />
              Open admin
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last update</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-300">
                      No automation jobs yet — they appear here when modules
                      enqueue work.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j.id} className="border-t border-ink-800">
                      <td className="px-3 py-2 text-ink-100">{j.job_type}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={j.status as never} />
                      </td>
                      <td className="px-3 py-2 text-ink-300">
                        {formatRelative(j.updated_at)}
                      </td>
                      <td className="px-3 py-2 text-ink-300">
                        {j.last_error ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// Daily usage card with humanized copy. "0/100" reads as broken; this shows
// either "100 chats remaining today" + "No chats used yet today" or
// "97 chats remaining today" + "3 used so far today".
function UsageCard({
  label,
  used,
  cap,
  unit,
  icon: Icon,
}: {
  label: string;
  used: number;
  cap: number;
  unit: string;
  icon: React.ComponentType<{ size?: number | string }>;
}) {
  const remaining = Math.max(cap - used, 0);
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const noneYet = used === 0;
  const headline = noneYet
    ? `${cap} ${unit}${cap === 1 ? "" : "s"} ready today`
    : `${remaining} ${unit}${remaining === 1 ? "" : "s"} remaining today`;
  const sub = noneYet
    ? `No ${unit}s used yet today.`
    : `${used} used so far · daily cap ${cap}`;
  return (
    <div className="card-padded space-y-2">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        <span className="text-ink-300">
          <Icon size={14} />
        </span>
      </div>
      <p className="text-base font-semibold text-ink-100">{headline}</p>
      <p className="text-[11px] text-ink-300">{sub}</p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent-orange"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
