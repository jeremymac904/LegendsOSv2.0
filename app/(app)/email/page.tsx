import { Mail } from "lucide-react";

import { EmailComposer } from "@/components/email/EmailComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv } from "@/lib/env";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { EmailCampaign } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .order("updated_at", { ascending: false });
  const campaigns = (data ?? []) as EmailCampaign[];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Studio"
        title="Newsletters and campaigns"
        description="Draft, preview, and approve. Sending is gated by ALLOW_LIVE_EMAIL_SEND and the email_send n8n workflow."
        action={
          <StatusPill
            status={env.SAFETY.allowLiveEmailSend ? "ok" : "warn"}
            label={env.SAFETY.allowLiveEmailSend ? "live send on" : "live send off"}
          />
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <EmailComposer />
        <aside className="space-y-3">
          <div className="card-padded text-xs text-ink-300">
            <p className="label">Templates</p>
            <ul className="mt-2 space-y-1 text-ink-200">
              <li>· Monthly market update</li>
              <li>· Rate-drop alert</li>
              <li>· Refi opportunity</li>
              <li>· First-time buyer guide</li>
            </ul>
            <p className="mt-3 text-[11px] text-ink-300">
              Templates ship as <code>shared_resources</code> with{" "}
              <code>resource_type='copy_template'</code> — owner-managed.
            </p>
          </div>
        </aside>
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your campaigns</h2>
            <p>Drafts and approved campaigns.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {campaigns.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No campaigns yet"
              description="Compose your first newsletter above."
            />
          ) : (
            campaigns.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
              >
                <header className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-100">{c.subject}</p>
                  <StatusPill status={c.status as never} />
                </header>
                {c.preview_text && (
                  <p className="text-xs text-ink-300">{c.preview_text}</p>
                )}
                <p className="mt-2 text-[11px] text-ink-300">
                  Updated {formatRelative(c.updated_at)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
