// LegendsOS v2 — Gmail AI Intake: email-intake webhook (n8n → LegendsOS).
// -------------------------------------------------------------------------
// Phase 1 SAFETY: this endpoint only RECORDS + CLASSIFIES + QUEUES. It NEVER
// sends a reply, deletes, marks-read, or files anything to a borrower folder.
//
// Flow:
//   1. verify shared-secret header (fail closed)
//   2. parse JSON defensively
//   3. classifyEmail() — cheap rules, escalate hard cases to DeepSeek, else
//      stays unknown_needs_review (classified_by "none"); we never guess.
//   4. resolve the watched mailbox to a team member (when present)
//   5. upsert on (source_account, gmail_message_id) for idempotent dedupe
//   6. write an append-only audit row for the receipt
//
// Degrades gracefully: a missing table / DB error returns a clear ok:false,
// never a 500.

import { NextResponse } from "next/server";

import { classifyEmail } from "@/lib/emailIntake/classify";
import { verifyWebhookSecret } from "@/lib/emailIntake/webhook";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EmailIntakeBody {
  source_account?: unknown;
  gmail_message_id?: unknown;
  gmail_thread_id?: unknown;
  from_address?: unknown;
  from_name?: unknown;
  to_address?: unknown;
  subject?: unknown;
  snippet?: unknown;
  received_at?: unknown;
  has_attachments?: unknown;
  raw_headers?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

export async function POST(req: Request) {
  // 1. Shared-secret gate (fail closed; never echoes the secret).
  const auth = verifyWebhookSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  // 2. Defensive JSON parse.
  let body: EmailIntakeBody;
  try {
    body = (await req.json()) as EmailIntakeBody;
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

  const fromAddress = asString(body.from_address);
  const fromName = asString(body.from_name);
  const subject = asString(body.subject);
  const snippet = asString(body.snippet);
  const hasAttachments = asBool(body.has_attachments);

  // 3. Classify (rules + DeepSeek hard pass; never guesses when AI is down).
  const classified = await classifyEmail({
    fromAddress,
    fromName,
    subject,
    snippet,
    hasAttachments,
  });

  // status: if nothing could classify it (classified_by "none") it stays in
  // the human Needs Review queue; otherwise it is Classified.
  const status = classified.classifiedBy === "none" ? "needs_review" : "classified";

  const supabase = getSupabaseServiceClient();

  // 4. Resolve the watched mailbox → team member (best-effort; non-fatal).
  let teamMemberId: string | null = null;
  try {
    const { data: member } = await supabase
      .from("email_intake_team")
      .select("id")
      .eq("gmail_address", sourceAccount)
      .maybeSingle();
    teamMemberId = (member?.id as string | undefined) ?? null;
  } catch {
    // Table missing or transient — proceed without routing; never throw.
    teamMemberId = null;
  }

  // 5. Idempotent upsert on (source_account, gmail_message_id).
  let messageId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("email_intake_messages")
      .upsert(
        {
          source_account: sourceAccount,
          team_member_id: teamMemberId,
          gmail_message_id: gmailMessageId,
          gmail_thread_id: asString(body.gmail_thread_id),
          from_address: fromAddress,
          from_name: fromName,
          to_address: asString(body.to_address),
          subject,
          snippet,
          received_at: asString(body.received_at),
          has_attachments: hasAttachments,
          classification: classified.category,
          classification_confidence: classified.confidence,
          classified_by: classified.classifiedBy,
          status,
          raw_headers:
            body.raw_headers && typeof body.raw_headers === "object"
              ? (body.raw_headers as Record<string, unknown>)
              : {},
        },
        { onConflict: "source_account,gmail_message_id" }
      )
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_unavailable",
          message:
            "Could not record the message. The intake tables may not be applied yet.",
          detail: error.message,
        },
        { status: 200 }
      );
    }
    messageId = (data?.id as string | undefined) ?? null;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_unavailable",
        message:
          "Could not record the message. The intake tables may not be applied yet.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }

  // 6. Append-only audit (best-effort; receipt is already recorded).
  try {
    await supabase.from("email_intake_audit").insert({
      actor_label: "system",
      action: "email_received",
      entity_type: "message",
      entity_id: messageId,
      detail: {
        source_account: sourceAccount,
        gmail_message_id: gmailMessageId,
        classification: classified.category,
        classified_by: classified.classifiedBy,
        status,
      },
    });
  } catch {
    // Audit is non-fatal; the message was recorded.
  }

  return NextResponse.json({
    ok: true,
    message_id: messageId,
    classification: classified.category,
    status,
  });
}
