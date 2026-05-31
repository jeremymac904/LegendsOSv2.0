import { NextResponse } from "next/server";

import { verifyN8nSignature } from "@/lib/automation/n8n";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IMPORTANT: Automation remains INACTIVE. Nothing in this route dispatches a
// workflow, sends an email, or publishes a post — outbound dispatch is gated
// elsewhere behind ALLOW_LIVE_* flags and is off by default. This handler only
// RECEIVES a callback and updates status rows. The hardening below exists
// purely to prevent FORGERY: because the update path uses the service-role
// client (which bypasses RLS), an unauthenticated POST must never be trusted.
//
// n8n posts back here when a workflow finishes. The caller must prove it holds
// the shared secret named N8N_WEBHOOK_SECRET by signing the EXACT raw body with
// HMAC-SHA256 and sending the hex digest in an `x-n8n-signature` header
// (an `x-signature` header is also accepted). We verify that BEFORE any DB
// write and return 401 on failure. As defense in depth we then confirm the
// job exists and is still in a dispatchable status before flipping it, which
// also keeps the operation idempotent (a replayed callback for an already
// finalized job is a no-op).
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

// A callback may only finalize a job that is still awaiting its result. Jobs
// already in a terminal state (succeeded / failed / cancelled) are NOT flipped
// again — this is the idempotency + replay guard.
const DISPATCHABLE_STATUSES = new Set(["queued", "sent"]);

export async function POST(req: Request) {
  // Read the RAW body once. The signature must be computed over these exact
  // bytes — re-serializing the parsed object would change whitespace/key order
  // and never match the sender's HMAC.
  const raw = await req.text();

  // Verify forgery protection BEFORE parsing or touching the database. Fail
  // closed: missing secret, missing header, or bad signature all yield 401.
  const signatureHeader =
    req.headers.get("x-n8n-signature") ?? req.headers.get("x-signature");
  if (!verifyN8nSignature(raw, signatureHeader)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Invalid or missing signature." },
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

  // Defense in depth: confirm the job exists and is still dispatchable before
  // writing anything. A signed-but-stale/replayed callback for an unknown or
  // already-finalized job is acknowledged without mutating state.
  const { data: job } = await service
    .from("automation_jobs")
    .select("status,target_table,target_id")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Unknown job." },
      { status: 404 }
    );
  }

  if (!DISPATCHABLE_STATUSES.has(job.status)) {
    // Idempotent no-op: job already finalized. Acknowledge without re-flipping.
    return NextResponse.json({ ok: true, status: "already_finalized" });
  }

  await service
    .from("automation_jobs")
    .update({
      status: ok ? "succeeded" : "failed",
      external_id: externalId,
      response: payload,
      completed_at: new Date().toISOString(),
      last_error: ok ? null : ((payload.error as string) ?? "n8n reported failure"),
    })
    .eq("id", jobId)
    // Only flip from a dispatchable status — narrows the race where two
    // concurrent callbacks arrive, keeping the update idempotent at the DB.
    .in("status", ["queued", "sent"]);

  // If the job targets a social post, propagate status.
  if (job.target_table === "social_posts" && job.target_id) {
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

  if (job.target_table === "email_campaigns" && job.target_id) {
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
