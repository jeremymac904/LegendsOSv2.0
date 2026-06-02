// LegendsOS v2 — Marketing lead intake webhook.
// ---------------------------------------------------------------------------
// Server-to-server only. This endpoint records normalized lead intake events,
// dedupes/updates the internal marketing contact, assigns the lead to an
// internal Atlas workflow, and creates draft follow-up tasks requiring approval.
//
// It does NOT send email/SMS, publish social, write to external CRMs, or call
// production webhooks.

import { NextResponse } from "next/server";

import { verifyWebhookSecret } from "@/lib/emailIntake/webhook";
import { leadIntakePayloadSchema } from "@/lib/leadIntake/types";
import { leadNeedsManualReview, processLeadIntake } from "@/lib/leadIntake/workflow";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyWebhookSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = leadIntakePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: "Request body does not match the canonical lead intake contract.",
        detail: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();
    const result = await processLeadIntake(supabase, parsed.data);
    const approvalTaskCount = result.tasks.filter((task) => task.requires_approval).length;

    return NextResponse.json({
      ok: true,
      lead_event_id: result.leadEvent.id,
      contact_id: result.contact?.id ?? null,
      assignment_id: result.assignment?.id ?? null,
      status: result.leadEvent.status,
      assigned_agent_type: result.assignment?.assigned_agent_type ?? null,
      followup_task_ids: result.tasks.map((task) => task.id),
      approval_required: approvalTaskCount > 0,
      manual_review_recommended: leadNeedsManualReview(parsed.data),
      external_actions: {
        email_sent: false,
        sms_sent: false,
        crm_written: false,
        social_published: false,
        production_webhook_called: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_unavailable",
        message:
          "Could not record the lead. Apply the lead intake migration before activating sources.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 200 }
    );
  }
}
