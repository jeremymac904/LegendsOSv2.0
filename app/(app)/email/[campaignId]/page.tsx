import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { EmailCampaign } from "@/types/database";

export const dynamic = "force-dynamic";

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
        action={<StatusPill status={campaign.status as never} />}
      />
      <article className="card-padded space-y-3">
        <pre className="whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-900/40 p-3 font-sans text-sm text-ink-100">
{campaign.body_text ?? "(no plaintext body)"}
        </pre>
        <p className="text-xs text-ink-300">
          {campaign.recipient_list ? `Recipient list: ${campaign.recipient_list}` : "No recipient list set"} ·
          updated {formatDate(campaign.updated_at)}
        </p>
      </article>
    </div>
  );
}
