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
    .select("id,user_id,status,media_id,metadata,title,channels")
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

  const meta = (post.metadata ?? {}) as {
    assets?: string[];
    media_ids?: string[];
    [k: string]: unknown;
  };
  const existing = Array.isArray(meta.assets) ? meta.assets : [];
  const existingMediaIds = Array.isArray(meta.media_ids) ? meta.media_ids : [];
  if (existing.includes(asset.id) || existingMediaIds.includes(asset.id)) {
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
      // Idempotent path — already attached. State that plainly so the user
      // can move on instead of wondering whether the action succeeded.
      message: `That asset is already on this draft, so I didn't change anything. Open Social Studio if you want to verify: /social/${post.id}`,
    };
  }

  const nextAssets = [...existing, asset.id];
  // Also mirror into metadata.media_ids — that's the contract the Social
  // composer reads when hydrating attached assets on draft reopen. Without
  // this, Atlas-attached images vanished from the composer (the asset row
  // stayed in metadata.assets[] but the composer only looked at media_ids).
  const nextMediaIds = existingMediaIds.includes(asset.id)
    ? existingMediaIds
    : [...existingMediaIds, asset.id];
  const updatePatch: Record<string, unknown> = {
    metadata: {
      ...meta,
      assets: nextAssets,
      media_ids: nextMediaIds,
      last_attached_by: "atlas_tool",
    },
  };
  // Mirror the primary media_id column when it's still null so the saved-list
  // thumbnail also shows up. This matches the contract /api/social uses.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(asset.id)) {
    updatePatch.media_id = (post as { media_id?: string | null }).media_id ?? asset.id;
  }
  const { error: updErr } = await supabase
    .from("social_posts")
    .update(updatePatch)
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
    // Warm + specific. We restate the draft-only gate so the chat bubble
    // matches the card's honest-action wording on attach.
    message: `I attached the asset to your draft — it stays a draft, nothing was posted. Open Social Studio to review: /social/${post.id}`,
  };
}
