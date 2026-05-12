import Link from "next/link";
import { Share2 } from "lucide-react";

import { SocialComposer } from "@/components/social/SocialComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv } from "@/lib/env";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { SocialPost } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SocialStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const { data } = await supabase
    .from("social_posts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(20);
  const posts = (data ?? []) as SocialPost[];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Social Studio"
        title="Multi-channel drafts"
        description="Compose once, target multiple channels. Live publishing is gated by ALLOW_LIVE_SOCIAL_PUBLISH and a configured n8n webhook."
        action={
          <StatusPill
            status={env.SAFETY.allowLiveSocialPublish ? "ok" : "warn"}
            label={
              env.SAFETY.allowLiveSocialPublish
                ? "live publishing on"
                : "live publishing off"
            }
          />
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <SocialComposer />
        <aside className="space-y-3">
          <div className="card-padded">
            <p className="label">Channels supported</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-200">
              <li className="chip">Facebook</li>
              <li className="chip">Instagram</li>
              <li className="chip">Google Business Profile</li>
              <li className="chip">YouTube</li>
            </ul>
            <p className="mt-3 text-[11px] text-ink-300">
              Each channel maps to a dedicated n8n workflow with HMAC-signed
              webhooks. No webhook → drafts queue, never auto-send.
            </p>
          </div>
        </aside>
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your posts</h2>
            <p>Drafts and scheduled posts you own.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {posts.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="No posts yet"
              description="Use the composer above to create your first draft."
            />
          ) : (
            posts.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
              >
                <header className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-100">
                    {p.title ?? "Untitled draft"}
                  </p>
                  <StatusPill status={p.status as never} />
                </header>
                <p className="mt-1 line-clamp-2 text-xs text-ink-300">{p.body}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-300">
                  <div className="flex flex-wrap gap-1">
                    {p.channels.map((c) => (
                      <span key={c} className="chip">
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  <span>Updated {formatRelative(p.updated_at)}</span>
                </div>
                {p.error_message && (
                  <p className="mt-2 rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-1 text-[11px] text-status-err">
                    {p.error_message}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
