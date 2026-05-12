import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { SocialPost } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SocialPostPage({
  params,
}: {
  params: { postId: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", params.postId)
    .maybeSingle();
  if (!data) notFound();
  const post = data as SocialPost;

  return (
    <div className="space-y-5">
      <Link href="/social" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Social Studio
      </Link>
      <SectionHeader
        eyebrow="Social post"
        title={post.title ?? "Untitled draft"}
        description="View-only for now. Edit in the composer to publish or schedule."
        action={<StatusPill status={post.status as never} />}
      />
      <article className="card-padded space-y-3">
        <p className="whitespace-pre-wrap text-sm text-ink-100">{post.body}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-300">
          <div className="flex flex-wrap gap-1">
            {post.channels.map((c) => (
              <span key={c} className="chip">
                {c.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          <div>
            {post.scheduled_at ? (
              <span>Scheduled · {formatDate(post.scheduled_at)}</span>
            ) : (
              <span>Saved · {formatDate(post.updated_at)}</span>
            )}
          </div>
        </div>
        {post.error_message && (
          <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
            {post.error_message}
          </p>
        )}
      </article>
    </div>
  );
}
