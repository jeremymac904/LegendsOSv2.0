// Attach a generated_media asset to an existing social_posts draft.
//
// The contract is a UPDATE on social_posts.metadata.assets[] (append) — we
// don't change channels, body, or status. The caller must own both the draft
// and the asset; RLS enforces that automatically. The handler refuses if the
// draft is already published / scheduled, since attaching after the fact has
// no effect downstream.

import type { AssetAttachedCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  AttachAssetInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "attach_asset_to_social_draft";

export async function attachAssetToSocialDraft(
  input: AttachAssetInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<AssetAttachedCard>> {
  const { supabase, profile } = ctx;
  const { social_post_id, asset_id } = input;

  // Confirm the draft exists, belongs to the caller, and is still a draft.
  const { data: post, error: postErr } = await supabase
    .from("social_posts")
    .select("id,user_id,status,metadata,title,channels")
    .eq("id", social_post_id)
    .maybeSingle();
  if (postErr || !post) {
    return {
      ok: false,
      error: "social_post_not_found",
      message:
        "I couldn't find that social draft. Open Social Studio and copy the draft id from the URL, then ask me again.",
    };
  }
  if (post.user_id !== profile.id) {
    return {
      ok: false,
      error: "not_owner",
      message:
        "That social draft belongs to someone else. Ask its owner to attach the asset, or work in your own drafts.",
    };
  }
  if (post.status !== "draft") {
    return {
      ok: false,
      error: "not_a_draft",
      message:
        `That social post is already ${post.status} — I only attach assets to drafts. Duplicate it first if you want a new draft.`,
    };
  }

  // Confirm the asset exists and belongs to the caller.
  const { data: asset, error: assetErr } = await supabase
    .from("generated_media")
    .select("id,user_id,prompt,preview_url")
    .eq("id", asset_id)
    .maybeSingle();
  if (assetErr || !asset) {
    return {
      ok: false,
      error: "asset_not_found",
      message:
        "I couldn't find that asset. Try retrieve_asset first, or open Assets to copy a valid id.",
    };
  }
  if (asset.user_id !== profile.id) {
    return {
      ok: false,
      error: "not_owner",
      message:
        "That asset belongs to a different user. Pick an asset from your own library.",
    };
  }

  const meta = (post.metadata ?? {}) as { assets?: string[]; [k: string]: unknown };
  const existing = Array.isArray(meta.assets) ? meta.assets : [];
  if (existing.includes(asset.id)) {
    const card: AssetAttachedCard = {
      kind: "asset_attached",
      tool_id: TOOL_ID,
      title: post.title ?? "Social draft",
      summary: "That asset was already attached.",
      link: `/social/${post.id}`,
      social_post_id: post.id,
      asset_id: asset.id,
    };
    return {
      ok: true,
      card,
      message: `That asset is already attached to the draft. Open it: /social/${post.id}`,
    };
  }

  const nextAssets = [...existing, asset.id];
  const { error: updErr } = await supabase
    .from("social_posts")
    .update({
      metadata: { ...meta, assets: nextAssets, last_attached_by: "atlas_tool" },
    })
    .eq("id", post.id);
  if (updErr) {
    return {
      ok: false,
      error: "update_failed",
      message:
        updErr.message ??
        "I couldn't attach that asset right now. Try again in a moment.",
    };
  }

  const card: AssetAttachedCard = {
    kind: "asset_attached",
    tool_id: TOOL_ID,
    title: post.title ?? "Social draft",
    summary: "Asset attached to the draft (still a draft — not posted).",
    link: `/social/${post.id}`,
    social_post_id: post.id,
    asset_id: asset.id,
  };
  return {
    ok: true,
    card,
    message: `Attached the asset to your social draft (still a draft — not posted). Open it: /social/${post.id}`,
  };
}
