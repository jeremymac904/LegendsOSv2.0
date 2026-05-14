import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueAutomationJob } from "@/lib/automation/n8n";
import { getServerEnv, PUBLIC_ENV } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { EmailCampaign } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single-recipient owner test send.
//
// This is a deliberately narrow endpoint:
//   * Owner-only. Other roles get a 403.
//   * ALLOW_LIVE_EMAIL_SEND must be true. When false we return a clean
//     { ok:false, error:"live_send_disabled" } so the UI can show its
//     copy without leaking the value of the env flag.
//   * Only dispatches to the resolved owner email — the audience the
//     campaign is otherwise targeted at is IGNORED. Even if the n8n
//     workflow is misconfigured, the payload it receives only has the
//     owner's address.
//   * Campaign must be in `draft` or `approved` status — never replays a
//     finalised send.
//   * Audit-logged via recordAudit so this shows up alongside other
//     owner-sensitive actions.

const schema = z.object({
  campaign_id: z.string().uuid(),
  recipient: z.string().email().optional(),
});

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Only the owner can run test sends.",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }

  const env = getServerEnv();
  if (!env.SAFETY.allowLiveEmailSend) {
    // Important: we still return 200 here. The UI shows the
    // "flip ALLOW_LIVE_EMAIL_SEND in Netlify env vars when ready" hint
    // — this isn't a server error, it's a deliberate owner gate.
    return NextResponse.json({
      ok: false,
      error: "live_send_disabled",
      message:
        "Test send disabled — flip ALLOW_LIVE_EMAIL_SEND in Netlify env vars when ready.",
    });
  }

  const supabase = getSupabaseServerClient();
  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Campaign not found." },
      { status: 404 }
    );
  }
  const row = campaign as EmailCampaign;
  if (row.status !== "draft" && row.status !== "approved") {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_status",
        message: `Test send only allowed on draft or approved campaigns (status=${row.status}).`,
      },
      { status: 409 }
    );
  }

  const recipient =
    parsed.data.recipient || profile.email || PUBLIC_ENV.OWNER_EMAIL;
  if (!recipient) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_recipient",
        message:
          "Owner email is not set on the profile and NEXT_PUBLIC_OWNER_EMAIL is empty.",
      },
      { status: 400 }
    );
  }

  const job = await enqueueAutomationJob({
    profile,
    job_type: "email_test_send",
    module: "email",
    target_table: "email_campaigns",
    target_id: row.id,
    webhook_key: "email_send",
    payload: {
      campaign_id: row.id,
      subject: row.subject,
      preview_text: row.preview_text,
      body_html: row.body_html,
      body_text: row.body_text,
      // Hard-overrides any audience the draft otherwise points at.
      recipient_list: `owner:${recipient}`,
      test_mode: true,
      test_recipient: recipient,
      metadata: { test_send: true, only_owner: true },
    },
    dispatch: true,
  });

  await recordAudit({
    actor: profile,
    action: "email_test_send_dispatched",
    target_type: "email_campaigns",
    target_id: row.id,
    metadata: {
      recipient,
      job_id: job.job_id,
      job_status: job.status,
      job_reason: job.reason ?? null,
      test_send: true,
      only_owner: true,
    },
  });

  return NextResponse.json({
    ok: true,
    job,
    recipient,
    campaign: { id: row.id, subject: row.subject, status: row.status },
  });
}
