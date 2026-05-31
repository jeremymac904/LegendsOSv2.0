// LegendsOS v2 — Gmail AI Intake: loan-update webhook (n8n → LegendsOS).
// -------------------------------------------------------------------------
// Phase 1 SAFETY: records a SUGGESTED or CONFIRMED loan match on an ingested
// message so a human can review it. It NEVER files attachments to a borrower
// folder, sends anything, or mutates the loan itself — that is a later phase.
//
// When loan_match_status === "confirmed" we advance the message status to
// "loan_matched" (a review state), but attachments stay in the review queue.

import { NextResponse } from "next/server";

import { verifyWebhookSecret } from "@/lib/emailIntake/webhook";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOAN_MATCH_STATUSES = new Set([
  "unmatched", "suggested", "confirmed", "rejected",
]);

interface LoanUpdateBody {
  gmail_message_id?: unknown;
  source_account?: unknown;
  loan_match_id?: unknown;
  loan_match_confidence?: unknown;
  loan_match_status?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
function asConfidence(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.max(0, Math.min(1, Number(v)));
  }
  return null;
}

export async function POST(req: Request) {
  const auth = verifyWebhookSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  let body: LoanUpdateBody;
  try {
    body = (await req.json()) as LoanUpdateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const sourceAccount = asString(body.source_account);
  const gmailMessageId = asString(body.gmail_message_id);
  if (!sourceAccount || !gmailMessageId) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_fields",
        message: "source_account and gmail_message_id are required.",
      },
      { status: 400 }
    );
  }

  const rawStatus = asString(body.loan_match_status);
  const loanMatchStatus =
    rawStatus && LOAN_MATCH_STATUSES.has(rawStatus) ? rawStatus : null;

  // Build the patch. Only set fields that were provided; confirmed matches also
  // advance the message status to the "loan_matched" review state.
  const patch: Record<string, unknown> = {};
  if ("loan_match_id" in body) patch.loan_match_id = asString(body.loan_match_id);
  if ("loan_match_confidence" in body) {
    patch.loan_match_confidence = asConfidence(body.loan_match_confidence);
  }
  if (loanMatchStatus) patch.loan_match_status = loanMatchStatus;
  if (loanMatchStatus === "confirmed") {
    // Review state only — DOES NOT file attachments to a borrower folder.
    patch.status = "loan_matched";
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "nothing_to_update",
        message:
          "Provide at least one of loan_match_id, loan_match_confidence, or loan_match_status.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceClient();

  let matchedMessageId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("email_intake_messages")
      .update(patch)
      .eq("source_account", sourceAccount)
      .eq("gmail_message_id", gmailMessageId)
      .select("id")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_unavailable",
          message:
            "Could not record the loan match. The intake tables may not be applied yet.",
          detail: error.message,
        },
        { status: 200 }
      );
    }
    matchedMessageId = (data?.id as string | undefined) ?? null;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_unavailable",
        message:
          "Could not record the loan match. The intake tables may not be applied yet.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }

  if (!matchedMessageId) {
    return NextResponse.json(
      {
        ok: false,
        error: "message_not_found",
        message:
          "No ingested message matches (source_account, gmail_message_id).",
      },
      { status: 200 }
    );
  }

  try {
    await supabase.from("email_intake_audit").insert({
      actor_label: "system",
      action: "loan_match_updated",
      entity_type: "message",
      entity_id: matchedMessageId,
      detail: {
        source_account: sourceAccount,
        gmail_message_id: gmailMessageId,
        loan_match_status: loanMatchStatus,
        confirmed: loanMatchStatus === "confirmed",
      },
    });
  } catch {
    // Non-fatal.
  }

  return NextResponse.json({ ok: true });
}
