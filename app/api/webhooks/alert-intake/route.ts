// LegendsOS v2 — Gmail AI Intake: alert-intake webhook (n8n → LegendsOS).
// -------------------------------------------------------------------------
// Phase 1 SAFETY: alerts are INTERNAL only and ALWAYS require human approval.
// This endpoint NEVER sends, delegates a send, or contacts a customer. It
// only queues an alert with decision "pending".
//
// Two modes:
//   * Create an alert: insert with decision "pending" (human approval gate).
//   * Confirm a dispatch: when n8n reports { dispatched:true, alert_id } for an
//     ALREADY-APPROVED internal alert, stamp dispatched_at. We do NOT create a
//     send, change the decision, or queue any outbound message here.

import { NextResponse } from "next/server";

import { verifyWebhookSecret } from "@/lib/emailIntake/webhook";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALERT_TYPES = new Set([
  "review", "urgent_condition", "phishing_risk", "new_lead", "lender_update", "other",
]);
const SEVERITIES = new Set(["low", "normal", "high", "urgent"]);
const CHANNELS = new Set(["in_app", "email_internal", "telegram", "none"]);

interface AlertIntakeBody {
  message_id?: unknown;
  alert_type?: unknown;
  severity?: unknown;
  target_account?: unknown;
  channel?: unknown;
  payload?: unknown;
  dispatched?: unknown;
  alert_id?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

export async function POST(req: Request) {
  const auth = verifyWebhookSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  let body: AlertIntakeBody;
  try {
    body = (await req.json()) as AlertIntakeBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceClient();

  // ---- Dispatch-confirmation mode --------------------------------------
  // n8n confirms a previously-APPROVED internal alert was sent. We only stamp
  // dispatched_at; we never create a send or flip the decision.
  if (body.dispatched === true) {
    const alertId = asString(body.alert_id);
    if (!alertId) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_fields",
          message: "alert_id is required to confirm a dispatch.",
        },
        { status: 400 }
      );
    }
    try {
      // Only stamp alerts that a human already approved. Never dispatch a
      // pending/dismissed alert.
      const { data, error } = await supabase
        .from("email_intake_alerts")
        .update({ dispatched_at: new Date().toISOString() })
        .eq("id", alertId)
        .eq("decision", "approved")
        .select("id")
        .maybeSingle();
      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: "db_unavailable",
            message:
              "Could not confirm the dispatch. The intake tables may not be applied yet.",
            detail: error.message,
          },
          { status: 200 }
        );
      }
      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: "not_dispatchable",
            message:
              "No approved alert matches alert_id; only human-approved alerts can be marked dispatched.",
          },
          { status: 200 }
        );
      }
      try {
        await supabase.from("email_intake_audit").insert({
          actor_label: "system",
          action: "alert_dispatch_confirmed",
          entity_type: "alert",
          entity_id: alertId,
          detail: { alert_id: alertId },
        });
      } catch {
        // Non-fatal.
      }
      return NextResponse.json({ ok: true, alert_id: alertId });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_unavailable",
          message:
            "Could not confirm the dispatch. The intake tables may not be applied yet.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 200 }
      );
    }
  }

  // ---- Create mode ------------------------------------------------------
  const rawType = asString(body.alert_type);
  if (!rawType) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", message: "alert_type is required." },
      { status: 400 }
    );
  }
  const alertType = ALERT_TYPES.has(rawType) ? rawType : "other";
  const rawSeverity = asString(body.severity);
  const severity = rawSeverity && SEVERITIES.has(rawSeverity) ? rawSeverity : "normal";
  const rawChannel = asString(body.channel);
  const channel = rawChannel && CHANNELS.has(rawChannel) ? rawChannel : "in_app";

  // Resolve target_account (a watched mailbox) → internal team member, if given.
  let targetTeamMemberId: string | null = null;
  const targetAccount = asString(body.target_account);
  if (targetAccount) {
    try {
      const { data: member } = await supabase
        .from("email_intake_team")
        .select("id")
        .eq("gmail_address", targetAccount)
        .maybeSingle();
      targetTeamMemberId = (member?.id as string | undefined) ?? null;
    } catch {
      targetTeamMemberId = null;
    }
  }

  let alertId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("email_intake_alerts")
      .insert({
        message_id: asString(body.message_id),
        alert_type: alertType,
        severity,
        target_team_member_id: targetTeamMemberId,
        // Human approval gate: nothing is ever dispatched until approved.
        decision: "pending",
        channel,
        payload:
          body.payload && typeof body.payload === "object"
            ? (body.payload as Record<string, unknown>)
            : {},
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_unavailable",
          message:
            "Could not queue the alert. The intake tables may not be applied yet.",
          detail: error.message,
        },
        { status: 200 }
      );
    }
    alertId = (data?.id as string | undefined) ?? null;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_unavailable",
        message:
          "Could not queue the alert. The intake tables may not be applied yet.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }

  try {
    await supabase.from("email_intake_audit").insert({
      actor_label: "system",
      action: "alert_queued",
      entity_type: "alert",
      entity_id: alertId,
      detail: {
        alert_type: alertType,
        severity,
        channel,
        message_id: asString(body.message_id),
        decision: "pending",
      },
    });
  } catch {
    // Non-fatal.
  }

  return NextResponse.json({ ok: true, alert_id: alertId });
}
