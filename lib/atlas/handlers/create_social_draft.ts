// Insert a draft social_posts row using the caller's RLS-respecting client.
// Never publishes — `status='draft'` is fixed.
//
// Honest-action-wording: every assistant message says "Saved your social draft
// (not posted, not sent — review it first)."

import type { SocialDraftCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CreateSocialDraftInput,
} from "@/lib/atlas/registry";
import type { SocialChannel } from "@/types/database";

const TOOL_ID = "create_social_draft";

export async function createSocialDraft(
  input: CreateSocialDraftInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<SocialDraftCard>> {
  const { profile, supabase } = ctx;
  const { title, body, channels } = input;

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      user_id: profile.id,
      organization_id: profile.organization_id,
      title: title ?? null,
      body,
      channels: channels as unknown as SocialChannel[],
      status: "draft",
      metadata: {
        source: "atlas_tool",
        tool_id: TOOL_ID,
        // Explicit flag picked up by Social Studio list cards to render
        // the small "Atlas" badge. Atlas always sets this when it creates
        // a draft on the owner's behalf.
        created_by_atlas: true,
      },
    })
    .select("id,title,body,channels")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "insert_failed",
      message:
        error?.message ??
        "I couldn't save your social draft. Try again, or open Social Studio to create it manually.",
    };
  }

  const card: SocialDraftCard = {
    kind: "social_draft",
    tool_id: TOOL_ID,
    title: title ?? "Social draft",
    summary: `Saved as a draft for ${channels.join(", ")}.`,
    link: `/social/${data.id}`,
    item_id: data.id,
    channels,
  };
  const message = `Saved your social draft (not posted, not sent — review it first). Open it: ${card.link}`;
  return { ok: true, card, message };
}
