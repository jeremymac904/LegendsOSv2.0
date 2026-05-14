import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SocialComposer } from "@/components/social/SocialComposer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  loadOrgUploadedImageAssets,
  loadSocialAssetUsageCounts,
} from "@/lib/admin/orgAssets";
import { imageLibrary } from "@/lib/assets";
import { getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { GeneratedMedia, SocialPost } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SocialPostPage({
  params,
}: {
  params: { postId: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  // Read the post + the same merged media library the create page uses, so
  // the composer can render attached thumbnails for any of the three id
  // shapes (generated_media UUID, uploaded shared_resources UUID,
  // manifest slug).
  const [{ data: postRow }, { data: generated }, uploadedImages, usageCounts] =
    await Promise.all([
      supabase
        .from("social_posts")
        .select("*")
        .eq("id", params.postId)
        .maybeSingle(),
      supabase
        .from("generated_media")
        .select("id,prompt,preview_url,status,created_at,provider,model")
        .order("created_at", { ascending: false })
        .limit(60),
      loadOrgUploadedImageAssets(),
      loadSocialAssetUsageCounts(),
    ]);

  if (!postRow) notFound();
  const post = postRow as SocialPost;

  const generatedRows = (generated ?? []) as Pick<
    GeneratedMedia,
    | "id"
    | "prompt"
    | "preview_url"
    | "status"
    | "created_at"
    | "provider"
    | "model"
  >[];

  const manifestAssetEntries: Pick<
    GeneratedMedia,
    "id" | "prompt" | "preview_url" | "status" | "created_at" | "provider" | "model"
  >[] = imageLibrary().map((a) => ({
    id: a.id,
    prompt: a.label,
    preview_url: a.public_path,
    status: "succeeded",
    created_at: new Date(0).toISOString(),
    provider: `asset:${a.category}`,
    model: null,
  }));

  const uploadedAssetEntries: Pick<
    GeneratedMedia,
    "id" | "prompt" | "preview_url" | "status" | "created_at" | "provider" | "model"
  >[] = uploadedImages.map((a) => ({
    id: a.id,
    prompt: a.label,
    preview_url: a.public_path,
    status: "succeeded",
    created_at: new Date().toISOString(),
    provider: `asset:uploaded:${a.category}`,
    model: null,
  }));

  const mediaLibrary = [
    ...generatedRows,
    ...uploadedAssetEntries,
    ...manifestAssetEntries,
  ];

  // Flatten the usage Map for client transport.
  const assetUsage: Record<string, number> = {};
  for (const [k, v] of usageCounts) assetUsage[k] = v;

  return (
    <div className="space-y-5">
      <Link href="/social" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Social Studio
      </Link>
      <SectionHeader
        eyebrow="Social post"
        title={post.title ?? "Edit draft"}
        description="Saved attachments and channels are preselected — tweak and re-save."
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill status={post.status as never} />
            <StatusPill
              status={env.SAFETY.allowLiveSocialPublish ? "ok" : "warn"}
              label={
                env.SAFETY.allowLiveSocialPublish
                  ? "external publishing enabled"
                  : "external publishing disabled"
              }
            />
          </div>
        }
      />
      <SocialComposer
        userId={profile.id}
        mediaLibrary={mediaLibrary}
        initialDraft={post}
        assetUsage={assetUsage}
      />
    </div>
  );
}
