import Link from "next/link";
import { Mail } from "lucide-react";

import { EmailComposer } from "@/components/email/EmailComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative, truncate } from "@/lib/utils";
import type { EmailCampaign } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .order("updated_at", { ascending: false });
  const campaigns = (data ?? []) as EmailCampaign[];
  const initial = searchParams?.id
    ? campaigns.find((c) => c.id === searchParams.id) ?? null
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Studio"
        title="Newsletters and campaigns"
        description="Compose with Markdown, preview the inbox layout, and save without sending. External sending is owner-controlled."
        action={
          <StatusPill
            status={env.SAFETY.allowLiveEmailSend ? "ok" : "warn"}
            label={
              env.SAFETY.allowLiveEmailSend
                ? "external sending enabled"
                : "external sending disabled"
            }
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <EmailComposer
          initialDraft={initial}
          liveSendEnabled={env.SAFETY.allowLiveEmailSend}
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
