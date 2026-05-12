import { createHmac, randomUUID } from "node:crypto";

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
  // false to keep external actions safe by default.
  dispatch?: boolean;
}

export interface EnqueueResult {
  job_id: string;
  status: "queued" | "sent" | "failed" | "blocked";
  reason?: string;
}

/**
 * Insert an automation_jobs row. Optionally POST the payload to n8n with an
 * HMAC signature. By default we DO NOT dispatch — the row is queued so that
 * Jeremy can review before live publishing is enabled.
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

  const shouldDispatch = args.dispatch === true && webhookUrl && env.N8N_WEBHOOK_SECRET;
  if (!shouldDispatch) {
    return {
      job_id: row.id,
      status: "queued",
      reason: webhookUrl
        ? "dispatch flag off — queued for review"
        : "no webhook configured",
    };
  }

  const body = JSON.stringify({ job_id: row.id, ...payload });
  const signature = createHmac("sha256", env.N8N_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-legendsos-signature": signature,
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

export function verifyN8nSignature(body: string, signature: string): boolean {
  const env = getServerEnv();
  if (!env.N8N_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", env.N8N_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return signature === expected;
}
