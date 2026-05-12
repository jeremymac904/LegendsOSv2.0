import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ImageIcon,
  Mail,
  MessageCircle,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAIProviderStatuses, PUBLIC_ENV } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type {
  AutomationJob,
  ChatThread,
  EmailCampaign,
  GeneratedMedia,
  ProviderCredentialPublic,
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
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: threads },
    { data: socialDrafts },
    { data: emailDrafts },
    { data: media },
    { data: providers },
    { data: usage24h },
    { data: recentJobs },
  ] = await Promise.all([
    supabase
      .from("chat_threads")
      .select("id,title,last_message_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
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
      .from("provider_credentials_public")
      .select("*")
      .order("provider"),
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
  ]);

  const chats = (threads ?? []) as Pick<
    ChatThread,
    "id" | "title" | "last_message_at" | "updated_at"
  >[];
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
  const providerRows = (providers ?? []) as ProviderCredentialPublic[];
  const liveProviderStatuses = getAIProviderStatuses();
  const events = (usage24h ?? []) as Pick<
    UsageEvent,
    "module" | "event_type" | "created_at"
  >[];
  const jobs = (recentJobs ?? []) as Pick<
    AutomationJob,
    "id" | "job_type" | "status" | "updated_at" | "last_error"
  >[];

  const owner = isOwner(profile);

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
          <StatCard
            label="Chats (24h)"
            value={events.filter((e) => e.module === "atlas").length}
            hint="Atlas messages logged today"
            icon={MessageCircle}
          />
          <StatCard
            label="Images (24h)"
            value={events.filter((e) => e.module === "images").length}
            hint="Generated media events"
            icon={ImageIcon}
          />
          <StatCard
            label="Social events (24h)"
            value={events.filter((e) => e.module === "social").length}
            hint="Drafts + publish requests"
            icon={Share2}
          />
          <StatCard
            label="Email events (24h)"
            value={events.filter((e) => e.module === "email").length}
            hint="Drafts + send requests"
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent Atlas chats</h2>
              <p>Continue or audit your latest threads.</p>
            </div>
            <Link href="/atlas" className="btn-ghost text-xs">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {chats.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No chats yet"
                description="Open Atlas Chat and ask your assistant anything. Usage is logged."
                action={
                  <Link href="/atlas" className="btn-primary">
                    Start a chat
                  </Link>
                }
              />
            ) : (
              chats.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/atlas/${thread.id}`}
                  className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2 text-sm transition hover:border-accent-gold/30"
                >
                  <span className="truncate text-ink-100">{thread.title}</span>
                  <span className="text-xs text-ink-300">
                    {formatRelative(
                      thread.last_message_at ?? thread.updated_at
                    )}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Provider status</h2>
              <p>Live env detection.</p>
            </div>
            <Link href="/settings" className="btn-ghost text-xs">
              Settings
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {liveProviderStatuses.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-ink-100">{p.label}</p>
                  <p className="text-[11px] text-ink-300">
                    {p.envVarNames.join(" / ")}
                  </p>
                </div>
                <StatusPill
                  status={
                    p.configured
                      ? p.enabled
                        ? "ok"
                        : "off"
                      : "missing"
                  }
                  label={
                    p.configured
                      ? p.enabled
                        ? "connected"
                        : "disabled"
                      : "missing"
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

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
              <h2>Recent imagery</h2>
              <p>Last six Image Studio outputs.</p>
            </div>
            <Link href="/images" className="btn-ghost text-xs">
              Open studio
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {images.length === 0 ? (
              <div className="col-span-3">
                <EmptyState
                  icon={Sparkles}
                  title="No generated images yet"
                  description="Provider must be configured first. See Settings → Providers."
                />
              </div>
            ) : (
              images.map((img) => (
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
