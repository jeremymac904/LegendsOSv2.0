import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users2 } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { EmailCampaign, NewsletterAudience } from "@/types/database";

export const dynamic = "force-dynamic";

// Defensive pluck of metadata.audience_id — same shape as the composer's
// reader. The metadata JSONB column has no schema guarantee.
function pickAudienceId(campaign: EmailCampaign): string | null {
  const meta = campaign.metadata;
  if (meta && typeof meta === "object") {
    const raw = (meta as Record<string, unknown>).audience_id;
    if (typeof raw === "string" && raw.length > 0) return raw;
  }
  const match = campaign.recipient_list?.match(/^audience:([0-9a-f-]{36})$/i);
  return match?.[1] ?? null;
}

export default async function EmailCampaignPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", params.campaignId)
    .maybeSingle();
  if (!data) notFound();
  const campaign = data as EmailCampaign;
  const audienceId = pickAudienceId(campaign);

  let audience: NewsletterAudience | null = null;
  if (audienceId) {
    const { data: aud } = await supabase
      .from("newsletter_audiences")
      .select("*")
      .eq("id", audienceId)
      .maybeSingle();
    audience = (aud as NewsletterAudience | null) ?? null;
  }

  return (
    <div className="space-y-5">
      <Link href="/email" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Email Studio
      </Link>
      <SectionHeader
        eyebrow="Email campaign"
        title={campaign.subject}
        description={campaign.preview_text ?? ""}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/email?id=${campaign.id}`}
              className="btn-primary text-xs"
            >
              Open in composer
            </Link>
            <StatusPill status={campaign.status as never} />
          </div>
        }
      />
      <article className="card-padded space-y-3">
        <pre className="whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-900/40 p-3 font-sans text-sm text-ink-100">
{campaign.body_text ?? "(no plaintext body)"}
        </pre>
        {audience && (
          <div className="flex items-start gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/5 p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-gold/20 text-accent-gold">
              <Users2 size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Audience
              </p>
              <p className="truncate text-sm font-semibold text-ink-100">
                {audience.name}
              </p>
              {audience.description && (
                <p className="mt-0.5 text-xs text-ink-300">
                  {audience.description}
                </p>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-ink-300">
          {campaign.recipient_list
            ? `Recipient list: ${campaign.recipient_list}`
            : "No recipient list set"}{" "}
          · updated {formatDate(campaign.updated_at)}
        </p>
      </article>
    </div>
  );
}
