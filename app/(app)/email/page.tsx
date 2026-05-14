import Link from "next/link";
import { Mail, Users2 } from "lucide-react";

import {
  EmailComposer,
  StarterTemplatesPanel,
} from "@/components/email/EmailComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv, PUBLIC_ENV } from "@/lib/env";
import { STARTER_TEMPLATES } from "@/lib/newsletter/starterTemplates";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative, truncate } from "@/lib/utils";
import type { EmailCampaign, NewsletterAudience } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage({
  searchParams,
}: {
  searchParams: { id?: string; audience?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const [{ data: campaignRows }, { data: audienceRows }, { data: contactCounts }] =
    await Promise.all([
      supabase
        .from("email_campaigns")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("newsletter_audiences")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("newsletter_contacts")
        .select("audience_id,status"),
    ]);
  const campaigns = (campaignRows ?? []) as EmailCampaign[];
  const audiences = (audienceRows ?? []) as NewsletterAudience[];
  const audienceCounts = new Map<string, { total: number; active: number }>();
  for (const c of (contactCounts ?? []) as {
    audience_id: string | null;
    status: string;
  }[]) {
    if (!c.audience_id) continue;
    const t = audienceCounts.get(c.audience_id) ?? { total: 0, active: 0 };
    t.total++;
    if (c.status === "active") t.active++;
    audienceCounts.set(c.audience_id, t);
  }
  const initial = searchParams?.id
    ? campaigns.find((c) => c.id === searchParams.id) ?? null
    : null;

  // /email?audience=<uuid> preselects the audience in the composer. We
  // validate it against the active audience list so a stale or wrong UUID
  // falls back to no preselection — never breaks the free-text mode.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const audienceParam = (searchParams?.audience ?? "").trim();
  const initialAudienceId =
    audienceParam && UUID_RE.test(audienceParam) &&
    audiences.some((a) => a.id === audienceParam)
      ? audienceParam
      : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Studio"
        title="Newsletters and campaigns"
        description="Compose with Markdown, preview the inbox layout, and save without sending. External sending is owner-controlled."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/email/audiences"
              className="btn px-3 py-1.5 text-xs"
              title="Manage audiences / import CSV"
            >
              <Users2 size={13} />
              Audiences ({audiences.length})
            </Link>
            <StatusPill
              status={env.SAFETY.allowLiveEmailSend ? "ok" : "warn"}
              label={
                env.SAFETY.allowLiveEmailSend
                  ? "external sending enabled"
                  : "external sending disabled"
              }
            />
          </div>
        }
      />

      {/* Starter templates panel — visible only when the org has zero
          campaigns (no drafts, no sends, nothing). Once the owner picks
          a template, /api/email returns the new draft id and we route to
          /email?id=<new>, which renders the composer the normal way. The
          panel never reappears after at least one draft exists. */}
      {campaigns.length === 0 && !initial && (
        <StarterTemplatesPanel templates={STARTER_TEMPLATES} />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <EmailComposer
          initialDraft={initial}
          initialAudienceId={initialAudienceId}
          liveSendEnabled={env.SAFETY.allowLiveEmailSend}
          ownerEmail={profile.email || PUBLIC_ENV.OWNER_EMAIL}
          ownerName={
            profile.full_name?.split(" ")[0] ??
            (profile.email
              ? profile.email.split("@")[0]
              : PUBLIC_ENV.OWNER_EMAIL.split("@")[0])
          }
          isOwner={isOwner(profile)}
          audiences={audiences.map((a) => ({
            id: a.id,
            name: a.name,
            total: audienceCounts.get(a.id)?.total ?? 0,
            active: audienceCounts.get(a.id)?.active ?? 0,
          }))}
        />
        <aside className="card-padded">
          <div className="section-title">
            <div>
              <h2>Drafts</h2>
              <p>Click any draft to load it into the composer.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-1">
            {campaigns.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No drafts yet"
                description="Compose your first newsletter on the left."
              />
            ) : (
              campaigns.map((c) => {
                const isActive = c.id === initial?.id;
                return (
                  <Link
                    key={c.id}
                    href={`/email?id=${c.id}`}
                    scroll={false}
                    className={`block rounded-lg border px-3 py-2 text-xs transition ${
                      isActive
                        ? "border-accent-gold/40 bg-accent-gold/10"
                        : "border-ink-800 bg-ink-900/40 hover:border-ink-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate font-medium ${
                          isActive ? "text-accent-gold" : "text-ink-100"
                        }`}
                      >
                        {truncate(c.subject, 50)}
                      </p>
                      <StatusPill status={c.status as never} />
                    </div>
                    {c.preview_text && (
                      <p className="line-clamp-1 text-[11px] text-ink-300">
                        {c.preview_text}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-400">
                      Updated {formatRelative(c.updated_at)}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
          {campaigns.length > 0 && (
            <div className="mt-3 border-t border-ink-800 pt-3">
              <Link href="/email" scroll={false} className="btn-ghost text-xs">
                Start a new draft
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
