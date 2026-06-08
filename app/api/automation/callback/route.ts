import { NextResponse } from "next/server";

import { N8N_SIGNATURE_HEADER, verifyN8nSignature } from "@/lib/automation/n8n";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// n8n posts back here when a workflow finishes. Callbacks must be HMAC-signed
// with N8N_WEBHOOK_SECRET; the server-issued job_id alone is not sufficient to
// update a matching row.
//
// Expected body:
// {
//   "job_id": "uuid",
//   "ok": true | false,
//   "external_id": "string",
//   "error": "string?",
//   "social_post_status"?: "published" | "failed",
//   "external_post_ids"?: { "facebook": "...", ... }
// }
export async function POST(req: Request) {
  const raw = await req.text();

  // FAIL CLOSED: reject unless the request carries a valid HMAC-SHA256 of the
  // raw body (keyed by N8N_WEBHOOK_SECRET) in the signature header. Without
  // this, a forged callback with a guessed job UUID could flip
  // automation_jobs / social_posts / email_campaigns to succeeded/published/sent.
  // This does NOT activate automation — nothing dispatches jobs.
  if (!verifyN8nSignature(raw, req.headers.get(N8N_SIGNATURE_HEADER) ?? "")) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthenticated",
        message: "Missing or invalid webhook signature.",
      },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Invalid JSON." },
      { status: 400 }
    );
  }
  const jobId = payload.job_id as string | undefined;
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Missing job_id." },
      { status: 400 }
    );
  }

  const service = getSupabaseServiceClient();
  const ok = Boolean(payload.ok);
  const externalId = (payload.external_id as string | undefined) ?? null;

  await service
    .from("automation_jobs")
    .update({
      status: ok ? "succeeded" : "failed",
      external_id: externalId,
      response: payload,
      completed_at: new Date().toISOString(),
      last_error: ok ? null : ((payload.error as string) ?? "n8n reported failure"),
    })
    .eq("id", jobId);

  // If the job targets a social post, propagate status.
  const { data: job } = await service
    .from("automation_jobs")
    .select("target_table,target_id")
    .eq("id", jobId)
    .maybeSingle();
  if (job?.target_table === "social_posts" && job.target_id) {
    await service
      .from("social_posts")
      .update({
        status: ok ? "published" : "failed",
        published_at: ok ? new Date().toISOString() : null,
        external_post_ids: (payload.external_post_ids as Record<string, unknown>) ?? {},
        error_message: ok ? null : ((payload.error as string) ?? null),
        n8n_execution_id: externalId,
      })
      .eq("id", job.target_id);
  }

  if (job?.target_table === "email_campaigns" && job.target_id) {
    await service
      .from("email_campaigns")
      .update({
        status: ok ? "sent" : "failed",
        sent_at: ok ? new Date().toISOString() : null,
      })
      .eq("id", job.target_id);
  }

  return NextResponse.json({ ok: true });
}
