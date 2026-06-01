// LegendsOS v2 — Lead intake test endpoint (owner-only)
// ---------------------------------------------------------------------------
// Lets the owner fire a signed test lead at /api/webhooks/lead-intake without
// visiting any external dashboard. The payload is signed with HMAC-SHA256
// using LEGENDSOS_WEBHOOK_SECRET so the target webhook accepts it.
//
// This endpoint never calls any external service — it only calls a local
// webhook route on the same server.

import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { WEBHOOK_SECRET_HEADER } from "@/lib/emailIntake/webhook";
import { PUBLIC_ENV } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  dry_run: z.boolean().optional(),
});

function getWebhookSecret(): string {
  return process.env.LEGENDSOS_WEBHOOK_SECRET ?? "";
}

function signPayload(secret: string, payloadJson: string): string {
  return createHmac("sha256", secret).update(payloadJson, "utf8").digest("hex");
}

function resolveOrigin(): string {
  // In a Next.js API route we don't have a Request object to derive origin
  // from, so we fall back to the configured APP_URL. For server-side
  // same-process calls this is always the right base.
  return (PUBLIC_ENV.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: Request) {
  // Auth: owner-only
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner only." },
      { status: 403 }
    );
  }

  // Parse body
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  const dryRun = parsed.success ? (parsed.data.dry_run ?? false) : false;

  // Check secret configured
  const secret = getWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "webhook_secret_missing",
        message:
          "Set LEGENDSOS_WEBHOOK_SECRET in your Netlify environment variables to enable lead intake testing.",
      },
      { status: 503 }
    );
  }

  // Build a valid test payload matching leadIntakePayloadSchema
  const testPayload = {
    source_system: "legendsos" as const,
    source_product: "admin_test",
    source_channel: null,
    source_page: "/admin/leads",
    source_component: "test_panel",
    source_url: null,
    utm: {},
    lead_type: "unknown_needs_review" as const,
    intent: "Test lead fired from LegendsOS admin panel.",
    priority: "low" as const,
    person: {
      name: "Test Lead",
      email: "test@legendsos.test",
      phone: null,
      preferred_contact: null,
    },
    market: {},
    relationship: {},
    message:
      "This is an owner test lead from LegendsOS admin. It can be safely deleted.",
    metadata: {
      test: true,
      fired_by: profile.id,
      fired_at: new Date().toISOString(),
    },
    consent: {
      privacy_acknowledged: false,
      marketing_opt_in: false,
      sms_opt_in: false,
    },
    created_at: new Date().toISOString(),
  };

  const payloadJson = JSON.stringify(testPayload);
  const signature = signPayload(secret, payloadJson);

  // Dry-run: validate + sign but don't post
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      payload: testPayload,
      signed: true,
      signature_header: WEBHOOK_SECRET_HEADER,
      message: "Dry-run: payload built and signed. No request sent.",
    });
  }

  // POST to the lead-intake webhook on the same origin
  const origin = resolveOrigin();
  const webhookUrl = `${origin}/api/webhooks/lead-intake`;

  let webhookResp: Response;
  try {
    webhookResp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [WEBHOOK_SECRET_HEADER]: signature,
      },
      body: payloadJson,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "fetch_failed",
        message: `Could not reach lead-intake webhook: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 502 }
    );
  }

  const webhookBody = await webhookResp.json().catch(() => null);

  // Audit the test fire (best-effort)
  await recordAudit({
    actor: profile,
    action: "lead_intake_test",
    target_type: "lead_intake_events",
    target_id: webhookBody?.lead_event_id ?? null,
    metadata: {
      webhook_status: webhookResp.status,
      webhook_ok: webhookBody?.ok ?? false,
    },
  });

  return NextResponse.json({
    ok: webhookBody?.ok ?? false,
    webhook_status: webhookResp.status,
    result: webhookBody,
  });
}
