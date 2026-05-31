import Link from "next/link";
import {
  Activity,
  BookOpen,
  Calendar,
  Clock,
  FileStack,
  GraduationCap,
  ImageIcon,
  Mail,
  MessageCircle,
  Share2,
  Sparkles,
  Workflow,
} from "lucide-react";

import { MetricStrip, type MetricItem } from "@/components/dashboard/MetricStrip";
import { QuickLaunch, type QuickLaunchTile } from "@/components/dashboard/QuickLaunch";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { imageLibrary } from "@/lib/assets";
import { renderEmailPreview } from "@/lib/email/render";
import { PUBLIC_ENV, getServerEnv } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type {
  AutomationJob,
  EmailCampaign,
  GeneratedMedia,
  SocialPost,
  UsageEvent,
} from "@/types/database";

export const dynamic = "force-dynamic";

// Quick-launch destinations — every href is a real route present in
// lib/navigation.ts and under app/(app)/. No dead tiles.
const QUICK_LAUNCH: QuickLaunchTile[] = [
  { href: "/atlas", label: "Atlas Chat", icon: MessageCircle },
  { href: "/images", label: "Image Studio", icon: ImageIcon },
  { href: "/social", label: "Social Studio", icon: Share2 },
  { href: "/email", label: "Email Studio", icon: Mail },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/marketing-materials", label: "Marketing", icon: FileStack },
  { href: "/lf-resources", label: "LF Resources", icon: Sparkles },
  { href: "/shared", label: "Shared", icon: Sparkles },
];

export default async function DashboardPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const next7DaysIso = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const owner = isOwner(profile);

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
    supabase
      .from("email_campaigns")
      .select("id,subject,preview_text,body_text,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  // Daily caps come from server env — drives the compact metric strip.
  const env = getServerEnv();
  const caps = env.DAILY_CAPS;
  const chatsUsed = events.filter((e) => e.module === "atlas").length;
  const imagesUsed = events.filter((e) => e.module === "images").length;
  const socialUsed = events.filter((e) => e.module === "social").length;
  const emailUsed = events.filter((e) => e.module === "email").length;

  const metrics: MetricItem[] = [
    { label: "Atlas chats", used: chatsUsed, cap: caps.chat, unit: "chat", icon: MessageCircle },
    { label: "Images", used: imagesUsed, cap: caps.images, unit: "image", icon: ImageIcon },
    { label: "Social", used: socialUsed, cap: caps.social, unit: "action", icon: Share2 },
    { label: "Email", used: emailUsed, cap: caps.email, unit: "action", icon: Mail },
  ];

  // Brand starters surface only when the image library is empty so the
  // imagery tab never looks dead. Owner-only assets filtered for the team.
  const brandStarters = imageLibrary()
    .filter((a) => owner || a.default_visibility === "team_shared")
    .filter(
      (a) =>
        a.category === "social_image" ||
        a.category === "image_studio_reference" ||
        a.category === "background"
    )
    .slice(0, 6);

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

  const draftCount = drafts.length + emails.length;

  // ----- Tab panels (server-rendered JSX passed into the client Tabs) -----
  const draftsPanel = (
    <div className="grid grid-cols-1 gap-2">
      {draftCount === 0 ? (
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
              className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3 transition hover:border-accent-champagne/40 dark:border-ink-800 dark:bg-ink-950/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                  {d.title || "Untitled social draft"}
                </p>
                <p className="line-clamp-1 text-xs text-ink-600 dark:text-ink-300">
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
              className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3 transition hover:border-accent-champagne/40 dark:border-ink-800 dark:bg-ink-950/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                  {e.subject || "Untitled email draft"}
                </p>
                <p className="text-xs text-ink-600 dark:text-ink-300">
                  Updated {formatRelative(e.updated_at)}
                </p>
              </div>
              <StatusPill status={e.status as never} />
            </Link>
          ))}
        </>
      )}
    </div>
  );

  const upcomingPanel = (
    <div className="grid grid-cols-1 gap-2">
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
            className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3 transition hover:border-accent-champagne/40 dark:border-ink-800 dark:bg-ink-950/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                {u.title}
              </p>
              <p className="text-xs text-ink-600 dark:text-ink-300">
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
  );

  const imageryPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-600 dark:text-ink-300">
          {images.length > 0
            ? "Last six Image Studio outputs."
            : "Curated starters from your brand library — generate a new image to replace these."}
        </p>
        <Link href="/images" className="btn-ghost text-xs">
          Open studio
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {images.length > 0
          ? images.map((img) => (
              <div
                key={img.id}
                className="aspect-square overflow-hidden rounded-xl border border-ink-200 bg-checker dark:border-ink-800"
                title={img.prompt}
              >
                {img.preview_url ? (
                  <img
                    src={img.preview_url}
                    alt={img.prompt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] text-ink-600 dark:text-ink-300">
                    {img.status}
                  </div>
                )}
              </div>
            ))
          : brandStarters.length > 0
          ? brandStarters.map((a) => (
              <div
                key={a.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-ink-200 bg-checker dark:border-ink-800"
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
                <span className="absolute bottom-1 left-1 right-1 rounded-md bg-white/70 px-1.5 py-0.5 text-[9px] text-ink-900 line-clamp-1 dark:bg-ink-950/70 dark:text-ink-100">
                  {a.label}
                </span>
              </div>
            ))
          : (
            <div className="col-span-3 sm:col-span-6">
              <EmptyState
                icon={Sparkles}
                title="No imagery yet"
                description="Open Image Studio to generate the first brand visual, or upload assets in the Admin Asset Library."
              />
            </div>
          )}
      </div>
      {latestNewsletter && (
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
          <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-300">
              Latest newsletter ·{" "}
              <span className="text-ink-500 dark:text-ink-400">
                {latestNewsletter.status} · {formatRelative(latestNewsletter.updated_at)}
              </span>
            </p>
            <Link href={`/email?id=${latestNewsletter.id}`} className="btn-ghost text-xs">
              <Mail size={13} />
              Continue editing
            </Link>
          </div>
          <iframe
            title="Latest newsletter preview"
            srcDoc={latestNewsletterHtml}
            sandbox=""
            className="block h-[260px] w-full bg-white dark:bg-ink-950"
          />
        </div>
      )}
    </div>
  );

  const activityPanel = (
    <div className="grid grid-cols-1 gap-2">
      {owner && (
        <div className="flex justify-end">
          <Link href="/admin/usage" className="btn-ghost text-xs">
            <Activity size={13} />
            Full feed
          </Link>
        </div>
      )}
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
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-950/40"
          >
            <p className="min-w-0 truncate text-sm text-ink-900 dark:text-ink-100">
              <span className="text-ink-600 dark:text-ink-300">
                {moduleLabel[ev.module] ?? ev.module}
              </span>{" "}
              {eventLabel[ev.event_type] ?? ev.event_type.replace(/_/g, " ")}
              <span className="ml-1 text-xs text-ink-500 dark:text-ink-400">
                · {formatRelative(ev.created_at)}
              </span>
            </p>
            <span className="chip">{ev.module}</span>
          </div>
        ))
      )}
    </div>
  );

  const jobsPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-600 dark:text-ink-300">
          n8n queue status — owner-only summary.
        </p>
        <Link href="/admin/usage" className="btn-ghost text-xs">
          <Workflow size={13} />
          Open admin
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/70 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
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
                <td colSpan={4} className="px-3 py-6 text-center text-ink-600 dark:text-ink-300">
                  No automation jobs yet — they appear here when modules enqueue work.
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="border-t border-ink-200 dark:border-ink-800">
                  <td className="px-3 py-2 text-ink-900 dark:text-ink-100">{j.job_type}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={j.status as never} />
                  </td>
                  <td className="px-3 py-2 text-ink-600 dark:text-ink-300">
                    {formatRelative(j.updated_at)}
                  </td>
                  <td className="px-3 py-2 text-ink-600 dark:text-ink-300">
                    {j.last_error ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tabs: TabItem[] = [
    {
      id: "drafts",
      label: draftCount > 0 ? `Drafts (${draftCount})` : "Drafts",
      icon: Share2,
      content: draftsPanel,
    },
    {
      id: "upcoming",
      label: upcoming.length > 0 ? `Upcoming (${upcoming.length})` : "Upcoming",
      icon: Calendar,
      content: upcomingPanel,
    },
    { id: "imagery", label: "Imagery", icon: ImageIcon, content: imageryPanel },
    { id: "activity", label: "Activity", icon: Activity, content: activityPanel },
    ...(owner
      ? [{ id: "jobs", label: "Automation", icon: Workflow, content: jobsPanel } as TabItem]
      : []),
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={owner ? "Owner view" : "Operator view"}
        title={`Welcome back${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.`}
        description={`${PUBLIC_ENV.TEAM_NAME}. One app, one login, one source of truth.`}
        action={
          <Link href="/atlas" className="btn-primary">
            <MessageCircle size={14} />
            Start Atlas chat
          </Link>
        }
      />

      <MetricStrip items={metrics} />

      <section className="space-y-2.5">
        <p className="label">Quick launch</p>
        <QuickLaunch tiles={QUICK_LAUNCH} />
      </section>

      <section className="card-padded">
        <Tabs tabs={tabs} variant="underline" />
      </section>
    </div>
  );
}
