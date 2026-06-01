/**
 * POST /api/integrations/google/calendar — REAL Calendar actions, gated + fail-closed.
 *
 * Actions:
 *   - list_events (READ)  : connection only.
 *   - create_event (WRITE): connection AND resolveLiveAction('calendar')
 *                           AND explicit confirm===true.
 *   - update_event (WRITE): same write gates.
 *
 * Provider: google_calendar. Honest JSON states. Tokens obtained server-side via
 * ensureFreshAccessToken; NEVER returned or logged. Audit captures non-PII
 * detail only (summary/ids; no attendee PII beyond counts).
 *
 * Body: { action, calendarId?, timeMin?, summary?, start?, end?, description?,
 *         attendees?, eventId?, patch?, confirm? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import {
  ensureFreshAccessToken,
  calendarListEvents,
  calendarCreateEvent,
  calendarUpdateEvent,
} from "@/lib/integrations/google";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google event date-time: either { date } (all-day) or { dateTime, timeZone? }.
const eventTimeSchema = z.record(z.unknown());

const schema = z.object({
  action: z.enum(["list_events", "create_event", "update_event"]),
  calendarId: z.string().min(1).max(255).optional(),
  timeMin: z.string().max(64).optional(),
  summary: z.string().max(1024).optional(),
  start: eventTimeSchema.optional(),
  end: eventTimeSchema.optional(),
  description: z.string().max(8192).optional(),
  attendees: z.array(z.string().email()).max(100).optional(),
  eventId: z.string().min(1).max(1024).optional(),
  patch: z.record(z.unknown()).optional(),
  confirm: z.boolean().optional(),
});

// Map an ensureFreshAccessToken failure reason to an honest connection status.
function tokenStatus(reason: "not_connected" | "needs_reauth" | "not_configured" | "error"): {
  status: "not_connected" | "needs_reauth" | "needs_setup";
  message: string;
} {
  if (reason === "not_connected") {
    return { status: "not_connected", message: "Calendar is not connected — connect your Google account first." };
  }
  if (reason === "needs_reauth") {
    return {
      status: "needs_reauth",
      message: "Calendar access expired or was revoked — reconnect to refresh access.",
    };
  }
  return {
    status: "needs_setup",
    message: "Calendar is not available — Google OAuth is not configured. Ask the owner to set it up.",
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
  const { action, calendarId, timeMin, summary, start, end, description, attendees, eventId, patch, confirm } =
    parsed.data;

  // Connection gate (all actions).
  const tok = await ensureFreshAccessToken(profile.id, "google_calendar");
  if (!tok.ok) {
    const mapped = tokenStatus(tok.reason);
    return NextResponse.json({ ok: false, status: mapped.status, message: mapped.message });
  }

  // ---- READ: list_events -> connection only --------------------------------
  if (action === "list_events") {
    let events;
    try {
      events = await calendarListEvents(tok.accessToken, { calendarId, timeMin, max: 10 });
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Calendar list failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "calendar_list_events",
      provider: "google_calendar",
      target_type: "calendar",
      target_id: calendarId ?? "primary",
      metadata: { count: events.length },
    });
    return NextResponse.json({ ok: true, status: "ok", action, events });
  }

  // ---- WRITES (create_event / update_event): gated -------------------------
  // Gate 1: user-enabled live calendar write (fail-closed).
  const live = await resolveLiveAction("calendar", {
    organizationId: profile.organization_id,
    userId: profile.id,
  });
  if (!live.allowed) {
    await recordIntegrationAudit({
      actor: profile,
      action: "calendar_write_blocked",
      provider: "google_calendar",
      target_type: "calendar",
      target_id: calendarId ?? "primary",
      metadata: { intent: action, reason: live.reason },
    });
    return NextResponse.json({
      ok: false,
      status: "disabled_by_user",
      reason: live.reason,
      message:
        "Live Calendar writes are turned off. Enable live Calendar in integration settings before changing events.",
    });
  }

  // Gate 2: explicit confirmation required.
  if (confirm !== true) {
    return NextResponse.json({
      ok: false,
      error: "confirmation_required",
      message: "Writing to Calendar requires confirm: true.",
    });
  }

  if (action === "create_event") {
    if (!summary || !start || !end) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "create_event requires summary, start, and end." },
        { status: 400 }
      );
    }
    let event;
    try {
      event = await calendarCreateEvent(tok.accessToken, {
        summary,
        start,
        end,
        description,
        attendees,
        calendarId,
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Calendar create failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "calendar_event_created",
      provider: "google_calendar",
      target_type: "calendar_event",
      target_id: event.id,
      metadata: { summary, attendee_count: attendees?.length ?? 0, calendar_id: calendarId ?? "primary" },
    });
    return NextResponse.json({ ok: true, status: "created", action, event });
  }

  // action === "update_event"
  if (!eventId || !patch) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "update_event requires eventId and patch." },
      { status: 400 }
    );
  }
  let updated;
  try {
    updated = await calendarUpdateEvent(tok.accessToken, { eventId, patch, calendarId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, status: "error", message: err instanceof Error ? err.message : "Calendar update failed." },
      { status: 502 }
    );
  }
  await recordIntegrationAudit({
    actor: profile,
    action: "calendar_event_updated",
    provider: "google_calendar",
    target_type: "calendar_event",
    target_id: updated.id,
    metadata: { calendar_id: calendarId ?? "primary" },
  });
  return NextResponse.json({ ok: true, status: "updated", action, event: updated });
}
