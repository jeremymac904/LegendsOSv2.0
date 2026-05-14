import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ChartLine,
  ImageIcon,
  Mail,
  MessageCircle,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
} from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative, truncate } from "@/lib/utils";
import type {
  AuditLog,
  AutomationJob,
  ChatThread,
  EmailCampaign,
  GeneratedMedia,
  Profile,
  ProviderCredentialPublic,
  SocialPost,
  UsageEvent,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminCenterPage() {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: members },
    { data: usage },
    { data: jobs },
    { data: audits },
    { data: providers },
    { data: chats },
    { data: socials },
    { data: emails },
    { data: media },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("usage_events")
      .select("module,event_type,created_at,user_id")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("automation_jobs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("provider_credentials_public").select("*"),
    supabase
      .from("chat_threads")
      .select("id,title,user_id,updated_at,last_message_at")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("social_posts")
      .select("id,title,body,user_id,status,channels,updated_at")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("email_campaigns")
      .select("id,subject,user_id,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("generated_media")
      .select("id,user_id,prompt,preview_url,status,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const membersList = (members ?? []) as Profile[];
  const usageList = (usage ?? []) as Pick<
    UsageEvent,
    "module" | "event_type" | "created_at" | "user_id"
  >[];
  const jobList = (jobs ?? []) as AutomationJob[];
  const auditList = (audits ?? []) as AuditLog[];
  const storedProviders = (providers ?? []) as ProviderCredentialPublic[];
  const recentChats = (chats ?? []) as Pick<
    ChatThread,
    "id" | "title" | "user_id" | "updated_at" | "last_message_at"
  >[];
  const recentSocial = (socials ?? []) as Pick<
    SocialPost,
    "id" | "title" | "body" | "user_id" | "status" | "channels" | "updated_at"
  >[];
  const recentEmail = (emails ?? []) as Pick<
    EmailCampaign,
    "id" | "subject" | "user_id" | "status" | "updated_at"
  >[];
  const recentMedia = (media ?? []) as Pick<
    GeneratedMedia,
    "id" | "user_id" | "prompt" | "preview_url" | "status" | "created_at"
  >[];

  const memberById = new Map(membersList.map((m) => [m.id, m]));
  const liveStatuses = getAIProviderStatuses();
  const storedByProvider = new Map(
    storedProviders.map((r) => [r.provider, r])
  );
  const previewLookup: Record<string, string> = {
    openrouter: env.OPENROUTER_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    nvidia: env.NVIDIA_API_KEY,
    fal: env.FAL_KEY,
    huggingface: env.HF_TOKEN,
  };

  function nameFor(userId: string | null | undefined): string {
    if (!userId) return "—";
    const m = memberById.get(userId);
    return m?.full_name ?? m?.email ?? userId.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin Center"
        title="Owner-only overview"
        description="Users, usage, automation jobs, audit trail, and provider status — every visibility on this page is gated by RLS plus the owner role check."
        action={<StatusPill status="ok" label="owner" />}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Team members"
          value={membersList.length}
          hint="Active profiles in org"
          icon={Users}
        />
        <StatCard
          label="Events (24h)"
          value={usageList.length}
          hint="Across every module"
          icon={Activity}
        />
        <StatCard
          label="Jobs queued"
          value={jobList.filter((j) => j.status === "queued").length}
          hint="Waiting for dispatch"
          icon={Server}
        />
        <StatCard
          label="Audit entries"
          value={auditList.length}
          hint="Last 15 actions"
          icon={ShieldCheck}
        />
      </section>

      <LiveUsageCard
        usageList={usageList}
        jobList={jobList}
        recentSocial={recentSocial}
        recentEmail={recentEmail}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent automation jobs</h2>
              <p>n8n queue status, last 10.</p>
            </div>
            <Link href="/admin/usage" className="btn-ghost text-xs">
              <ChartLine size={14} />
              All usage
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Last update</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {jobList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-ink-300">
                      No jobs yet.
                    </td>
                  </tr>
                ) : (
                  jobList.map((j) => (
                    <tr key={j.id} className="border-t border-ink-800">
                      <td className="px-3 py-2 text-ink-100">{j.job_type}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={j.status as never} />
                      </td>
                      <td className="px-3 py-2 text-ink-300">{j.attempts}</td>
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
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Providers</h2>
              <p>Live env detection + stored placeholder.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {liveStatuses.map((p) => {
              const stored = storedByProvider.get(p.id);
              const preview =
                maskedKeyPreview(previewLookup[p.id] ?? "") ||
                stored?.masked_preview ||
                "";
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2"
                >
                  <div>
                    <p className="text-ink-100">{p.label}</p>
                    <p className="text-[11px] text-ink-300">
                      {p.envVarNames.join(" / ")}
                    </p>
                    {preview && (
                      <p className="font-mono text-[10px] text-ink-400">
                        {preview}
                      </p>
                    )}
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
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent chats</h2>
              <p>Cross-team thread activity (owner read).</p>
            </div>
            <Link href="/atlas" className="btn-ghost text-xs">
              <MessageCircle size={14} />
              Open Atlas
            </Link>
          </div>
          <div className="mt-3 grid gap-2">
            {recentChats.length === 0 ? (
              <p className="text-xs text-ink-300">No chats yet.</p>
            ) : (
              recentChats.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink-100">
                      {truncate(t.title, 60)}
                    </p>
                    <p className="text-ink-300">{nameFor(t.user_id)}</p>
                  </div>
                  <span className="text-ink-300">
                    {formatRelative(t.last_message_at ?? t.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent social drafts</h2>
              <p>Across all users (owner read).</p>
            </div>
            <Link href="/social" className="btn-ghost text-xs">
              <Share2 size={14} />
              Open Social
            </Link>
          </div>
          <div className="mt-3 grid gap-2">
            {recentSocial.length === 0 ? (
              <p className="text-xs text-ink-300">No social drafts yet.</p>
            ) : (
              recentSocial.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-ink-100">
                      {s.title ?? truncate(s.body, 40)}
                    </p>
                    <StatusPill status={s.status as never} />
                  </div>
                  <p className="text-ink-300">
                    {nameFor(s.user_id)} · {formatRelative(s.updated_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent email drafts</h2>
              <p>Across all users (owner read).</p>
            </div>
            <Link href="/email" className="btn-ghost text-xs">
              <Mail size={14} />
              Open Email
            </Link>
          </div>
          <div className="mt-3 grid gap-2">
            {recentEmail.length === 0 ? (
              <p className="text-xs text-ink-300">No email drafts yet.</p>
            ) : (
              recentEmail.map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-ink-100">{truncate(e.subject, 50)}</p>
                    <StatusPill status={e.status as never} />
                  </div>
                  <p className="text-ink-300">
                    {nameFor(e.user_id)} · {formatRelative(e.updated_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent generated media</h2>
              <p>Image Studio activity.</p>
            </div>
            <Link href="/images" className="btn-ghost text-xs">
              <ImageIcon size={14} />
              Open Images
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {recentMedia.length === 0 ? (
              <p className="col-span-3 text-xs text-ink-300">
                No generated images yet.
              </p>
            ) : (
              recentMedia.map((m) => (
                <div
                  key={m.id}
                  className="overflow-hidden rounded-lg border border-ink-800 bg-checker text-[10px]"
                  title={m.prompt}
                >
                  {m.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.preview_url}
                      alt={m.prompt}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center text-ink-300">
                      {m.status}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Audit log</h2>
            <p>Last 15 security-relevant actions.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {auditList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink-300">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                auditList.map((a) => (
                  <tr key={a.id} className="border-t border-ink-800">
                    <td className="px-3 py-2 text-ink-100">{a.action}</td>
                    <td className="px-3 py-2 text-ink-300">
                      {a.target_type ?? "—"} {a.target_id ? `· ${a.target_id.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {nameFor(a.actor_user_id)}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(a.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------
// Live usage card — compact 24h snapshot of every module so admins have a
// single-pane summary without leaving /admin. Numbers are derived from the
// already-fetched usage_events + automation_jobs lists; we don't pull more
// data than the page already loads.
function LiveUsageCard({
  usageList,
  jobList,
  recentSocial,
  recentEmail,
}: {
  usageList: Pick<UsageEvent, "module" | "event_type" | "created_at" | "user_id">[];
  jobList: AutomationJob[];
  recentSocial: Pick<
    SocialPost,
    "id" | "title" | "body" | "user_id" | "status" | "channels" | "updated_at"
  >[];
  recentEmail: Pick<
    EmailCampaign,
    "id" | "subject" | "user_id" | "status" | "updated_at"
  >[];
}) {
  // Active users (24h): distinct user_ids that fired any event.
  const activeUsers = new Set<string>();
  for (const e of usageList) {
    if (e.user_id) activeUsers.add(e.user_id);
  }

  // Module counts. usage_events.module strings match the studios; we
  // intentionally count "chats" via the `atlas` module to keep the label
  // user-friendly.
  let atlasChats = 0;
  let imagesGenerated = 0;
  let socialPostsQueued = 0;
  let newslettersDrafted = 0;
  for (const e of usageList) {
    if (e.module === "atlas") atlasChats++;
    if (e.module === "images" && e.event_type !== "view") imagesGenerated++;
    if (e.module === "social" && e.event_type === "queued") socialPostsQueued++;
    if (e.module === "email" && e.event_type !== "view") newslettersDrafted++;
  }
  // Fall back to deriving the social/email counts from the most-recent rows
  // when usage_events doesn't carry the expected event_type — keeps the card
  // useful even before the studios start emitting structured events.
  if (socialPostsQueued === 0) {
    socialPostsQueued = recentSocial.filter((s) => s.status === "scheduled").length;
  }
  if (newslettersDrafted === 0) {
    newslettersDrafted = recentEmail.filter((e) => e.status === "draft").length;
  }

  // n8n queue depth = automation_jobs.status === "queued" (and "sent" rows in
  // flight that haven't yet succeeded/failed). The enum only has the five
  // states defined in types/database.ts — no "retrying" state today.
  const queueDepth = jobList.filter(
    (j) => j.status === "queued" || j.status === "sent"
  ).length;

  const tiles: { label: string; value: number; hint: string }[] = [
    {
      label: "Active users (24h)",
      value: activeUsers.size,
      hint: "Distinct people firing events",
    },
    {
      label: "Atlas chats (24h)",
      value: atlasChats,
      hint: "Assistant turns logged",
    },
    {
      label: "Images generated (24h)",
      value: imagesGenerated,
      hint: "Image Studio runs",
    },
    {
      label: "Social posts queued (24h)",
      value: socialPostsQueued,
      hint: "Scheduled for publishing",
    },
    {
      label: "Newsletters drafted (24h)",
      value: newslettersDrafted,
      hint: "Email Studio drafts",
    },
    {
      label: "n8n queue depth",
      value: queueDepth,
      hint: "queued + retrying jobs",
    },
  ];

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent-gold" />
            Live usage (24h)
          </h2>
          <p>
            Single-pane snapshot pulled from <code>usage_events</code> and{" "}
            <code>automation_jobs</code>. Mirrors the dashboard numbers so
            admins can spot anomalies without bouncing tabs.
          </p>
        </div>
        <Link href="/admin/usage" className="btn-ghost text-xs">
          <ChartLine size={14} />
          7-day breakdown
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
              {t.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-100">
              {t.value}
            </p>
            <p className="mt-0.5 text-[10px] text-ink-300">{t.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
