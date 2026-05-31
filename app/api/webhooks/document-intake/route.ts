// LegendsOS v2 — Gmail AI Intake: document-intake webhook (n8n → LegendsOS).
// -------------------------------------------------------------------------
// Phase 1 SAFETY: this endpoint only RECORDS attachment metadata into the
// review queue. It NEVER downloads, uploads, files to a borrower folder, or
// touches Gmail. n8n later routes unknown/approved files to the Drive
// "Needs Review" folder and calls back; nothing is uploaded here.
//
// Every attachment is inserted with status "pending_review" and
// drive_location "pending". Obviously-dangerous files (executable/script
// extensions, double extensions, or a mime/extension mismatch) are flagged
// status "suspicious" with a suspicious_reason for the human reviewer.

import { NextResponse } from "next/server";

import { verifyWebhookSecret } from "@/lib/emailIntake/webhook";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingAttachment {
  file_name?: unknown;
  mime_type?: unknown;
  size_bytes?: unknown;
  gmail_attachment_id?: unknown;
}
interface DocumentIntakeBody {
  source_account?: unknown;
  gmail_message_id?: unknown;
  attachments?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
function asSize(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.max(0, Math.trunc(Number(v)));
  }
  return null;
}

// Extensions that should never be silently filed. .zip is included because it
// can hide payloads; reviewers decide.
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "scr", "js", "jse", "vbs", "vbe", "bat", "cmd", "com", "pif", "msi",
  "jar", "ps1", "hta", "wsf", "lnk", "zip",
]);

// Common document mime expectations keyed by extension. A mismatch is flagged.
const EXPECTED_MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function extensionsOf(fileName: string): string[] {
  // Returns lowercased extension segments after the first dot, in order.
  // e.g. "invoice.pdf.exe" => ["pdf", "exe"].
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.slice(1) : [];
}

interface SuspicionResult {
  suspicious: boolean;
  reason: string | null;
}

function assessSuspicion(
  fileName: string | null,
  mimeType: string | null
): SuspicionResult {
  if (!fileName) return { suspicious: false, reason: null };
  const exts = extensionsOf(fileName);
  if (exts.length === 0) return { suspicious: false, reason: null };

  const finalExt = exts[exts.length - 1];

  // 1. Dangerous final extension.
  if (DANGEROUS_EXTENSIONS.has(finalExt)) {
    return {
      suspicious: true,
      reason: `Potentially dangerous file type ".${finalExt}".`,
    };
  }

  // 2. Double extension where an inner segment looks like a document but the
  //    final segment is something else (classic disguise: report.pdf.scr).
  if (exts.length >= 2) {
    const inner = exts[exts.length - 2];
    if (EXPECTED_MIME_BY_EXT[inner] && inner !== finalExt) {
      return {
        suspicious: true,
        reason: `Double extension ".${inner}.${finalExt}" — possible disguised file.`,
      };
    }
  }

  // 3. Mime / extension mismatch for known document types.
  const expected = EXPECTED_MIME_BY_EXT[finalExt];
  if (expected && mimeType && mimeType.toLowerCase() !== expected) {
    return {
      suspicious: true,
      reason: `MIME type "${mimeType}" does not match extension ".${finalExt}".`,
    };
  }

  return { suspicious: false, reason: null };
}

export async function POST(req: Request) {
  const auth = verifyWebhookSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  let body: DocumentIntakeBody;
  try {
    body = (await req.json()) as DocumentIntakeBody;
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

  if (!Array.isArray(body.attachments) || body.attachments.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_fields",
        message: "attachments must be a non-empty array.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceClient();

  // Find the parent message (must already be ingested via /email-intake).
  let parentMessageId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("email_intake_messages")
      .select("id")
      .eq("source_account", sourceAccount)
      .eq("gmail_message_id", gmailMessageId)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_unavailable",
          message:
            "Could not look up the parent message. The intake tables may not be applied yet.",
          detail: error.message,
        },
        { status: 200 }
      );
    }
    parentMessageId = (data?.id as string | undefined) ?? null;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_unavailable",
        message:
          "Could not look up the parent message. The intake tables may not be applied yet.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }

  if (!parentMessageId) {
    return NextResponse.json(
      {
        ok: false,
        error: "message_not_found",
        message:
          "No ingested message matches (source_account, gmail_message_id). Send the email to /email-intake first.",
      },
      { status: 200 }
    );
  }

  const rows = (body.attachments as IncomingAttachment[]).map((att) => {
    const fileName = asString(att.file_name);
    const mimeType = asString(att.mime_type);
    const { suspicious, reason } = assessSuspicion(fileName, mimeType);
    return {
      message_id: parentMessageId,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: asSize(att.size_bytes),
      gmail_attachment_id: asString(att.gmail_attachment_id),
      // Phase 1 never uploads — location stays "pending" until n8n routes it.
      drive_location: "pending" as const,
      status: (suspicious ? "suspicious" : "pending_review") as
        | "suspicious"
        | "pending_review",
      suspicious_reason: reason,
    };
  });

  let attachmentIds: string[] = [];
  try {
    const { data, error } = await supabase
      .from("email_intake_attachments")
      .insert(rows)
      .select("id");
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_unavailable",
          message:
            "Could not record attachments. The intake tables may not be applied yet.",
          detail: error.message,
        },
        { status: 200 }
      );
    }
    attachmentIds = (data ?? []).map((r) => r.id as string);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_unavailable",
        message:
          "Could not record attachments. The intake tables may not be applied yet.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }

  try {
    await supabase.from("email_intake_audit").insert({
      actor_label: "system",
      action: "attachments_received",
      entity_type: "message",
      entity_id: parentMessageId,
      detail: {
        source_account: sourceAccount,
        gmail_message_id: gmailMessageId,
        attachment_count: attachmentIds.length,
        suspicious_count: rows.filter((r) => r.status === "suspicious").length,
      },
    });
  } catch {
    // Non-fatal.
  }

  return NextResponse.json({ ok: true, attachment_ids: attachmentIds });
}
