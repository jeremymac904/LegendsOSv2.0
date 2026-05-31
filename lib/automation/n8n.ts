import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type N8nWebhookKey =
  | "social_publish"
  | "gbp_post"
  | "facebook_post"
  | "instagram_post"
  | "youtube_post"
  | "email_send"
  | "daily_usage"
  | "provider_health"
  | "content_reminder"
  | "failed_publish_recovery";

export interface EnqueueArgs {
  profile: Profile | null;
  job_type: string;
  module: string;
  target_table?: string;
  target_id?: string;
  webhook_key?: N8nWebhookKey;
  payload?: Record<string, unknown>;
  scheduled_at?: string | null;
  // When `dispatch` is false, the row is queued but NOT sent. Defaults to
  // false to keep external actions safe by default. Dispatch flips on via
  // ALLOW_LIVE_SOCIAL_PUBLISH / ALLOW_LIVE_EMAIL_SEND at the caller.
  dispatch?: boolean;
}

export interface EnqueueResult {
  job_id: string;
  status: "queued" | "sent" | "failed" | "blocked";
  reason?: string;
}

/**
 * Resolve the configured webhook URL for a given n8n job type. Returns `null`
 * when no URL is configured — callers should treat that as "queue but do not
 * dispatch" instead of substituting a fake URL.
 *
 * This is server-only — never import from a client component.
 */
export function getWebhookUrl(jobType: N8nWebhookKey): string | null {
  const env = getServerEnv();
  const url = env.N8N_WEBHOOKS[jobType];
  if (!url || url.trim() === "") return null;
  return url;
}

/**
 * Snapshot of n8n configuration state for the integrations-status endpoint.
 * Returns booleans only — never any URL or key material.
 */
export function getN8nConfigState() {
  const env = getServerEnv();
  const webhooks = env.N8N_WEBHOOKS;
  const flags = {
    social_publish: Boolean(webhooks.social_publish),
    email_send: Boolean(webhooks.email_send),
    content_reminder: Boolean(webhooks.content_reminder),
    daily_usage: Boolean(webhooks.daily_usage),
    failed_publish_recovery: Boolean(webhooks.failed_publish_recovery),
    provider_health: Boolean(webhooks.provider_health),
  };
  const base_url_present = Boolean(env.N8N_BASE_URL || env.N8N_WEBHOOK_BASE_URL);
  const anyWebhook = Object.values(flags).some(Boolean);
  return {
    configured: base_url_present && anyWebhook,
    base_url_present,
    webhooks: flags,
  };
}

/**
 * Insert an `automation_jobs` row, and (optionally) POST the payload to the
 * configured n8n webhook URL.
 *
 * The n8n workflows accept simple JSON POSTs — no HMAC, no shared secret.
 * Dispatch only fires when the caller explicitly opts in (typically gated
 * behind ALLOW_LIVE_SOCIAL_PUBLISH / ALLOW_LIVE_EMAIL_SEND). When dispatch
 * is off OR no webhook URL is configured, the row is queued for review.
 */
export async function enqueueAutomationJob(args: EnqueueArgs): Promise<EnqueueResult> {
  const env = getServerEnv();
  const service = getSupabaseServiceClient();
  const webhookUrl = args.webhook_key ? env.N8N_WEBHOOKS[args.webhook_key] : "";

  const payload = args.payload ?? {};
  const idempotencyKey = randomUUID();

  const { data: row, error } = await service
    .from("automation_jobs")
    .insert({
      user_id: args.profile?.id ?? null,
      organization_id: args.profile?.organization_id ?? null,
      job_type: args.job_type,
      module: args.module,
      target_table: args.target_table ?? null,
      target_id: args.target_id ?? null,
      payload: { ...payload, idempotency_key: idempotencyKey },
      status: "queued",
      webhook_url: webhookUrl || null,
      scheduled_at: args.scheduled_at ?? null,
    })
    .select("*")
    .single();

  if (error || !row) {
    return {
      job_id: "",
      status: "failed",
      reason: error?.message ?? "insert failed",
    };
  }

  const shouldDispatch = args.dispatch === true && Boolean(webhookUrl);
  if (!shouldDispatch) {
    return {
      job_id: row.id,
      status: "queued",
      reason: webhookUrl
        ? "external action disabled — queued for owner review"
        : "no webhook configured",
    };
  }

  const body = JSON.stringify({ job_id: row.id, ...payload });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-legendsos-job-id": row.id,
      },
      body,
      cache: "no-store",
    });
    const text = await res.text();
    await service
      .from("automation_jobs")
      .update({
        status: res.ok ? "sent" : "failed",
        attempts: row.attempts + 1,
        last_error: res.ok ? null : text.slice(0, 500),
        started_at: new Date().toISOString(),
        response: { status: res.status, body: text.slice(0, 2000) },
      })
      .eq("id", row.id);
    return {
      job_id: row.id,
      status: res.ok ? "sent" : "failed",
      reason: res.ok ? undefined : `n8n ${res.status}`,
    };
  } catch (e) {
    await service
      .from("automation_jobs")
      .update({
        status: "failed",
        attempts: row.attempts + 1,
        last_error: e instanceof Error ? e.message : "dispatch failed",
      })
      .eq("id", row.id);
    return {
      job_id: row.id,
      status: "failed",
      reason: e instanceof Error ? e.message : "dispatch failed",
    };
  }
}

/**
 * Inbound n8n callback verification — HMAC-SHA256, constant-time, fail-closed.
 *
 * The callback route uses the service-role client to flip job / social / email
 * status, so an unauthenticated POST must NEVER be trusted. We require the
 * caller to prove possession of the shared secret named `N8N_WEBHOOK_SECRET`
 * by sending an HMAC-SHA256 of the EXACT raw request body in a signature
 * header. We recompute that HMAC here and compare with `timingSafeEqual`.
 *
 * Fail closed in every ambiguous case:
 *   - secret env var unset / empty            -> false
 *   - signature header missing / empty        -> false
 *   - signature not valid hex of expected len -> false
 *   - digests differ                          -> false
 *
 * This function references the env var NAME only; it never logs or returns the
 * secret value. It does NOT activate any automation — it only decides whether
 * an inbound callback is authentic.
 *
 * @param rawBody         the EXACT raw request body (pre-JSON.parse); HMAC over
 *                        a re-serialized object would not match the sender.
 * @param signatureHeader the value of the signature header, optionally prefixed
 *                        with "sha256=" (commonly used by webhook senders).
 */
export function verifyN8nSignature(
  rawBody: string,
  signatureHeader: string | null | undefined
): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  // Fail closed: no shared secret configured means we cannot authenticate any
  // caller, so we reject every callback rather than trusting it.
  if (!secret || secret.trim() === "") return false;

  // Fail closed: a missing/blank signature header cannot be verified.
  if (!signatureHeader || signatureHeader.trim() === "") return false;

  // Accept an optional "sha256=" prefix; normalize to lowercase hex.
  const provided = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
  // Reject anything that isn't a clean hex string before touching Buffers.
  if (!/^[0-9a-f]+$/.test(provided)) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  // timingSafeEqual throws on length mismatch — guard first so a wrong-length
  // signature fails closed instead of raising.
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
