import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv, PUBLIC_ENV } from "@/lib/env";
import { enqueueAutomationJob } from "@/lib/automation/n8n";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { logUsage, recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  campaign_id: z.string().uuid().nullish(),
  subject: z.string().min(1).max(300),
  preview_text: z.string().max(200).nullish(),
  body_html: z.string().nullish(),
  body_text: z.string().nullish(),
  template_key: z.string().nullish(),
  recipient_list: z.string().nullish(),
  // The composer derives this from the audience picker. We persist it in
  // metadata.audience_id (no dedicated column in email_campaigns) so the
  // composer can re-hydrate the selection on reopen even when the
  // free-text recipient_list also carries `audience:<uuid>`.
  audience_id: z.string().uuid().nullish(),
  action: z
    .enum(["draft", "approve", "request_send", "request_test"])
    .default("draft"),
});

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
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
  const data = parsed.data;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  // Test sends do NOT bump the campaign status — the draft stays a draft so
  // the owner can keep iterating after previewing in their own inbox.
  const status =
    data.action === "request_send"
      ? "approved"
      : data.action === "approve"
      ? "approved"
      : "draft";

  // Merge audience_id into metadata. We prefer the explicit `audience_id`
  // field from the composer, but fall back to parsing `audience:<uuid>` out
  // of recipient_list so legacy drafts still round-trip cleanly. When
  // updating an existing row we read the current metadata first so we
  // don't clobber unrelated fields.
  const recipientAudienceMatch =
    data.recipient_list?.match(/^audience:([0-9a-f-]{36})$/i) ?? null;
  const incomingAudienceId =
    data.audience_id ?? recipientAudienceMatch?.[1] ?? null;

  let row;
  if (data.campaign_id) {
    const { data: existing } = await supabase
      .from("email_campaigns")
      .select("metadata")
      .eq("id", data.campaign_id)
      .maybeSingle();
    const existingMeta =
      existing && typeof existing.metadata === "object" && existing.metadata
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const mergedMeta = {
      ...existingMeta,
      audience_id: incomingAudienceId ?? null,
    };
    const { data: updated, error: upErr } = await supabase
      .from("email_campaigns")
      .update({
        subject: data.subject,
        preview_text: data.preview_text ?? null,
        body_html: data.body_html ?? null,
        body_text: data.body_text ?? null,
        template_key: data.template_key ?? null,
        recipient_list: data.recipient_list ?? null,
        metadata: mergedMeta,
        status,
      })
      .eq("id", data.campaign_id)
      .select("*")
      .single();
    if (upErr || !updated) {
      return NextResponse.json(
        { ok: false, error: "internal_error", message: upErr?.message ?? "update failed" },
        { status: 500 }
      );
    }
    row = updated;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("email_campaigns")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        subject: data.subject,
        preview_text: data.preview_text ?? null,
        body_html: data.body_html ?? null,
        body_text: data.body_text ?? null,
        template_key: data.template_key ?? null,
        recipient_list: data.recipient_list ?? null,
        metadata: { audience_id: incomingAudienceId ?? null },
        status,
      })
      .select("*")
      .single();
    if (insErr || !inserted) {
      return NextResponse.json(
        { ok: false, error: "internal_error", message: insErr?.message ?? "insert failed" },
        { status: 500 }
      );
    }
    row = inserted;
  }

  await logUsage(profile, {
    module: "email",
    event_type:
      data.action === "request_send"
        ? "campaign_send_requested"
        : data.action === "request_test"
        ? "campaign_test_requested"
        : data.action === "approve"
        ? "campaign_approved"
        : "campaign_drafted",
    metadata: { campaign_id: row.id },
  });

  let job: { job_id: string; status: string; reason?: string } | null = null;
  let testRecipient: string | null = null;
  if (data.action === "request_send") {
    job = await enqueueAutomationJob({
      profile,
      job_type: "email_send",
      module: "email",
      target_table: "email_campaigns",
      target_id: row.id,
      webhook_key: "email_send",
      payload: {
        campaign_id: row.id,
        subject: row.subject,
        recipient_list: row.recipient_list,
      },
      dispatch: env.SAFETY.allowLiveEmailSend,
    });
    await recordAudit({
      actor: profile,
      action: "email_send_requested",
      target_type: "email_campaigns",
      target_id: row.id,
      metadata: { dispatch: env.SAFETY.allowLiveEmailSend, job_id: job.job_id },
    });
  } else if (data.action === "request_test") {
    // Owner-only inbox test. The recipient is HARD-CODED to the owner's
    // email — even if the form's recipient_list pointed at an audience,
    // it is ignored here. This is what keeps "Queue test to me" from ever
    // hitting the broader list.
    testRecipient = profile.email || PUBLIC_ENV.OWNER_EMAIL;
    if (!testRecipient) {
      return NextResponse.json(
        {
          ok: false,
          error: "bad_request",
          message:
            "Owner email is not set on your profile, and NEXT_PUBLIC_OWNER_EMAIL is empty. Set one before queuing a test.",
        },
        { status: 400 }
      );
    }
    job = await enqueueAutomationJob({
      profile,
      job_type: "email_test_send",
      module: "email",
      target_table: "email_campaigns",
      target_id: row.id,
      webhook_key: "email_send",
      payload: {
        campaign_id: row.id,
        subject: row.subject,
        // Override with the owner's email only. The n8n workflow can read
        // `test_mode: true` and refuse to look up audience contacts.
        recipient_list: `owner:${testRecipient}`,
        test_mode: true,
        test_recipient: testRecipient,
      },
      dispatch: env.SAFETY.allowLiveEmailSend,
    });
    await recordAudit({
      actor: profile,
      action: "email_test_requested",
      target_type: "email_campaigns",
      target_id: row.id,
      metadata: {
        dispatch: env.SAFETY.allowLiveEmailSend,
        job_id: job.job_id,
        recipient: testRecipient,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    campaign: row,
    job,
    test_recipient: testRecipient,
  });
}
