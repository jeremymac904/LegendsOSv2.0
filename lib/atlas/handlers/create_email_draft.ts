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
      metadata: { source: "atlas_tool", tool_id: TOOL_ID },
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
  const message = `Saved your newsletter draft (not sent — I won't dispatch unless ALLOW_LIVE_EMAIL_SEND is on). Open it: ${card.link}`;
  return { ok: true, card, message };
}
