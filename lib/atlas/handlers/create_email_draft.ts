// Insert a draft email_campaigns row. Never sends — `status='draft'` is
// fixed. Live send requires the owner to flip ALLOW_LIVE_EMAIL_SEND outside
// this code path.

import type { EmailDraftCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CreateEmailDraftInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "create_email_draft";

export async function createEmailDraft(
  input: CreateEmailDraftInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<EmailDraftCard>> {
  const { profile, supabase } = ctx;
  const { subject, body } = input;

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      user_id: profile.id,
      organization_id: profile.organization_id,
      subject,
      body_text: body,
      body_html: null,
      status: "draft",
      metadata: {
        source: "atlas_tool",
        tool_id: TOOL_ID,
        // Explicit flag picked up by Email Studio drafts list to render
        // the small "Atlas" badge. Atlas always sets this when it creates
        // a draft on the owner's behalf.
        created_by_atlas: true,
      },
    })
    .select("id,subject")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "insert_failed",
      message:
        error?.message ??
        "I couldn't save your newsletter draft. Try again or open Email Studio to create it manually.",
    };
  }

  const card: EmailDraftCard = {
    kind: "email_draft",
    tool_id: TOOL_ID,
    title: data.subject ?? subject,
    summary: "Saved as a draft. Live send stays off until the owner flips ALLOW_LIVE_EMAIL_SEND.",
    link: `/email/${data.id}`,
    item_id: data.id,
    subject: data.subject ?? subject,
  };
  // Warm + specific. We name the subject so the user can confirm Atlas
  // captured the right campaign, and we restate the live-send gate so the
  // chat bubble carries the same honest-action note as the card.
  const message = [
    `I created the email draft "${data.subject ?? subject}" and kept external sending disabled.`,
    `Review it in Email Studio before sending — I won't dispatch unless ALLOW_LIVE_EMAIL_SEND is on: ${card.link}`,
  ].join(" ");
  return { ok: true, card, message };
}
