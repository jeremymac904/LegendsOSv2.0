/**
 * POST /api/integrations/google/gmail — REAL Gmail actions, gated + fail-closed.
 *
 * Actions:
 *   - list_recent (READ)  : connection only. Returns REDACTED summaries
 *                           (From/Subject/Date + snippet) — NO bodies/attachments.
 *   - create_draft        : connection only. Creates a draft; never sends.
 *   - send (LIVE)         : connection AND user-enabled (resolveLiveAction('email'))
 *                           AND explicit confirm===true. Any gate failing => no send.
 *
 * Honest JSON states throughout. Tokens are obtained server-side via
 * ensureFreshAccessToken and NEVER returned or logged. Audit captures non-PII
 * detail only (recipient ok; NO message body).
 *
 * Body: { action, to?, subject?, body?, confirm? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { ensureFreshAccessToken, gmailListRecent, gmailCreateDraft, gmailSend } from "@/lib/integrations/google";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["list_recent", "create_draft", "send"]),
  to: z.string().email().max(320).optional(),
  subject: z.string().max(998).optional(),
  body: z.string().max(100_000).optional(),
  confirm: z.boolean().optional(),
});

// Map an ensureFreshAccessToken failure reason to an honest connection status.
function tokenStatus(reason: "not_connected" | "needs_reauth" | "not_configured" | "error"): {
  status: "not_connected" | "needs_reauth" | "needs_setup";
  message: string;
} {
  if (reason === "not_connected") {
    return { status: "not_connected", message: "Gmail is not connected — connect your Google account first." };
  }
  if (reason === "needs_reauth") {
    return { status: "needs_reauth", message: "Gmail access expired or was revoked — reconnect to refresh access." };
  }
  // not_configured | error
  return {
    status: "needs_setup",
    message: "Gmail is not available — Google OAuth is not configured. Ask the owner to set it up.",
  };
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated", message: "Sign in first." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }
  const { action, to, subject, body, confirm } = parsed.data;

  // Connection gate (all actions require a live token).
  const tok = await ensureFreshAccessToken(profile.id, "gmail");
  if (!tok.ok) {
    const mapped = tokenStatus(tok.reason);
    return NextResponse.json({ ok: false, status: mapped.status, message: mapped.message });
  }

  // ---- READ: list_recent -> redacted summaries -----------------------------
  if (action === "list_recent") {
    let messages;
    try {
      messages = await gmailListRecent(tok.accessToken, 10);
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Gmail list failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "gmail_list_recent",
      provider: "gmail",
      target_type: "gmail",
      target_id: profile.id,
      metadata: { count: messages.length },
    });
    return NextResponse.json({ ok: true, status: "ok", action, messages });
  }

  // ---- create_draft: connection only ---------------------------------------
  if (action === "create_draft") {
    if (!to || !subject || body === undefined) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "create_draft requires to, subject, and body." },
        { status: 400 }
      );
    }
    let draft;
    try {
      draft = await gmailCreateDraft(tok.accessToken, { to, subject, body });
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Gmail draft failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "gmail_draft_created",
      provider: "gmail",
      target_type: "gmail_draft",
      target_id: draft.id,
      metadata: { recipient: to, subject }, // non-PII metadata only — never the body
    });
    return NextResponse.json({ ok: true, status: "ok", action, draft_id: draft.id });
  }

  // ---- send (LIVE): connection AND user-enabled AND explicit confirm --------
  if (!to || !subject || body === undefined) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "send requires to, subject, and body." },
      { status: 400 }
    );
  }

  // Gate 1: user-enabled live email (fail-closed).
  const live = await resolveLiveAction("email", {
    organizationId: profile.organization_id,
    userId: profile.id,
  });
  if (!live.allowed) {
    await recordIntegrationAudit({
      actor: profile,
      action: "gmail_send_blocked",
      provider: "gmail",
      target_type: "gmail",
      target_id: profile.id,
      metadata: { recipient: to, reason: live.reason },
    });
    return NextResponse.json({
      ok: false,
      status: "disabled_by_user",
      reason: live.reason,
      message:
        "Live email sending is turned off. Enable live email in integration settings before sending real mail.",
    });
  }

  // Gate 2: explicit confirmation required.
  if (confirm !== true) {
    return NextResponse.json({
      ok: false,
      error: "confirmation_required",
      message: "Sending a real email requires confirm: true.",
    });
  }

  // All gates passed — send for real.
  let sent;
  try {
    sent = await gmailSend(tok.accessToken, { to, subject, body });
  } catch (err) {
    return NextResponse.json(
      { ok: false, status: "error", message: err instanceof Error ? err.message : "Gmail send failed." },
      { status: 502 }
    );
  }
  await recordIntegrationAudit({
    actor: profile,
    action: "gmail_sent",
    provider: "gmail",
    target_type: "gmail_message",
    target_id: sent.id,
    metadata: { recipient: to, subject }, // non-PII metadata only — never the body
  });
  return NextResponse.json({ ok: true, status: "sent", action, message_id: sent.id });
}
