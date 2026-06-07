import { NextResponse } from "next/server";

import { enqueueAutomationJob } from "@/lib/automation/n8n";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { Profile } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How many due rows to process per run, per table. Keeps the cron invocation
// well within the Netlify function time budget.
const BATCH_LIMIT = 25;

// Give up after this many attempts. The row is then marked failed (terminal).
const MAX_ATTEMPTS = 5;

// Exponential backoff between attempts, indexed by the attempt number that
// JUST failed (1-based). attempt 1 -> wait 5m, attempt 2 -> 15m, attempt 3+ ->
// 60m. The final attempt (== MAX_ATTEMPTS) does not schedule a retry — it
// transitions the row to a terminal failed state.
const BACKOFF_MINUTES = [5, 15, 60];

function backoffMs(attemptThatFailed: number): number {
  const idx = Math.min(attemptThatFailed - 1, BACKOFF_MINUTES.length - 1);
  const minutes = BACKOFF_MINUTES[Math.max(idx, 0)];
  return minutes * 60 * 1000;
}

// enqueueAutomationJob / recordAudit only read `id` and `organization_id` off
// the actor. We never have a session in cron, so we synthesize a minimal,
// row-scoped actor from the owning user_id/organization_id.
function actorFor(userId: string | null, organizationId: string | null): Profile {
  return {
    id: userId ?? "",
    email: "",
    full_name: null,
    role: "viewer",
    organization_id: organizationId,
    avatar_url: null,
    is_active: true,
    last_seen_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  } as Profile;
}

interface RunSummary {
  processed: number;
  published: number;
  retried: number;
  failed: number;
}

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

interface SocialPostRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  body: string | null;
  channels: string[] | null;
  scheduled_at: string | null;
  publish_attempts_count: number | null;
  metadata: Record<string, unknown> | null;
}

interface EmailCampaignRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  subject: string | null;
  recipient_list: string | null;
  scheduled_at: string | null;
  publish_attempts_count: number | null;
}

// Shared outcome handler. Increments the attempt counter, stamps last_attempt_at,
// and either marks the row succeeded, schedules a backoff retry, or marks it
// terminally failed once attempts are exhausted.
async function applyOutcome(args: {
  service: ServiceClient;
  table: "social_posts" | "email_campaigns";
  rowId: string;
  priorAttempts: number;
  success: boolean;
  successStatus: string;
  scheduledStatus: string;
  successColumn: string; // published_at | sent_at
  errorReason: string;
  summary: RunSummary;
}): Promise<void> {
  const {
    service,
    table,
    rowId,
    priorAttempts,
    success,
    successStatus,
    scheduledStatus,
    successColumn,
    errorReason,
    summary,
  } = args;

  const nowIso = new Date().toISOString();
  const attempts = priorAttempts + 1;

  if (success) {
    await service
      .from(table)
      .update({
        status: successStatus,
        publish_attempts_count: attempts,
        last_attempt_at: nowIso,
        next_attempt_at: null,
        publish_error: null,
        [successColumn]: nowIso,
      })
      .eq("id", rowId);
    summary.published += 1;
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    await service
      .from(table)
      .update({
        status: "failed",
        publish_attempts_count: attempts,
        last_attempt_at: nowIso,
        next_attempt_at: null,
        publish_error: errorReason.slice(0, 500),
      })
      .eq("id", rowId);
    summary.failed += 1;
    return;
  }

  // Stays in its scheduled state; retried after the backoff window.
  const nextIso = new Date(Date.now() + backoffMs(attempts)).toISOString();
  await service
    .from(table)
    .update({
      status: scheduledStatus,
      publish_attempts_count: attempts,
      last_attempt_at: nowIso,
      next_attempt_at: nextIso,
      publish_error: errorReason.slice(0, 500),
    })
    .eq("id", rowId);
  summary.retried += 1;
}

async function processSocial(
  service: ServiceClient,
  summary: RunSummary
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("social_posts")
    .select(
      "id,user_id,organization_id,body,channels,scheduled_at,publish_attempts_count,metadata"
    )
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .lt("publish_attempts_count", MAX_ATTEMPTS)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error || !data) return;

  for (const row of data as SocialPostRow[]) {
    summary.processed += 1;
    const priorAttempts = row.publish_attempts_count ?? 0;
    const actor = actorFor(row.user_id, row.organization_id);

    // Per-row live resolution. Cron has no session, so we resolve the owner's
    // in-app live-social toggle (and org-level safe mode) directly.
    let dispatch = false;
    let reason = "no_user";
    if (row.user_id) {
      const live = await resolveLiveAction("social", {
        organizationId: row.organization_id,
        userId: row.user_id,
      });
      dispatch = live.allowed;
      reason = live.reason;
    }

    let success = false;
    let errorReason = `live_social_${reason}`;
    try {
      const job = await enqueueAutomationJob({
        profile: actor,
        job_type: "social_publish",
        module: "social",
        target_table: "social_posts",
        target_id: row.id,
        webhook_key: "social_publish",
        payload: {
          post_id: row.id,
          body: row.body ?? "",
          channels: row.channels ?? [],
          scheduled_at: row.scheduled_at,
          source: "scheduler",
        },
        scheduled_at: row.scheduled_at,
        dispatch,
      });
      // A row counts as published only when the job was actually dispatched to
      // n8n ("sent"). Queued/blocked outcomes mean the live gate is off or no
      // webhook is configured — those retry until attempts are exhausted.
      success = job.status === "sent";
      if (!success) errorReason = job.reason ?? `job_${job.status}`;
    } catch (err) {
      errorReason = err instanceof Error ? err.message : "dispatch_failed";
    }

    await applyOutcome({
      service,
      table: "social_posts",
      rowId: row.id,
      priorAttempts,
      success,
      successStatus: "published",
      scheduledStatus: "scheduled",
      successColumn: "published_at",
      errorReason,
      summary,
    });
  }
}

async function processEmail(
  service: ServiceClient,
  summary: RunSummary
): Promise<void> {
  const nowIso = new Date().toISOString();
  // A scheduled campaign is one approved for sending with a future
  // scheduled_at. Once due, the processor dispatches it.
  const { data, error } = await service
    .from("email_campaigns")
    .select(
      "id,user_id,organization_id,subject,recipient_list,scheduled_at,publish_attempts_count"
    )
    .eq("status", "approved")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", nowIso)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .lt("publish_attempts_count", MAX_ATTEMPTS)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error || !data) return;

  for (const row of data as EmailCampaignRow[]) {
    summary.processed += 1;
    const priorAttempts = row.publish_attempts_count ?? 0;
    const actor = actorFor(row.user_id, row.organization_id);

    let dispatch = false;
    let reason = "no_user";
    if (row.user_id) {
      const live = await resolveLiveAction("email", {
        organizationId: row.organization_id,
        userId: row.user_id,
      });
      dispatch = live.allowed;
      reason = live.reason;
    }

    let success = false;
    let errorReason = `live_email_${reason}`;
    try {
      const job = await enqueueAutomationJob({
        profile: actor,
        job_type: "email_send",
        module: "email",
        target_table: "email_campaigns",
        target_id: row.id,
        webhook_key: "email_send",
        payload: {
          campaign_id: row.id,
          subject: row.subject ?? "",
          recipient_list: row.recipient_list ?? null,
          scheduled_at: row.scheduled_at,
          source: "scheduler",
        },
        scheduled_at: row.scheduled_at,
        dispatch,
      });
      success = job.status === "sent";
      if (!success) errorReason = job.reason ?? `job_${job.status}`;
    } catch (err) {
      errorReason = err instanceof Error ? err.message : "dispatch_failed";
    }

    await applyOutcome({
      service,
      table: "email_campaigns",
      rowId: row.id,
      priorAttempts,
      success,
      successStatus: "sent",
      // Email has no dedicated "scheduled" enum value — a pending send stays
      // 'approved' (with next_attempt_at set) until it succeeds or fails.
      scheduledStatus: "approved",
      successColumn: "sent_at",
      errorReason,
      summary,
    });
  }
}

async function run(): Promise<NextResponse> {
  // Fail closed: without a configured secret the endpoint refuses to run, so a
  // missing-secret deploy can never process (and publish) anything.
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_configured",
        message: "CRON_SECRET is not set. The scheduler is disabled.",
      },
      { status: 503 }
    );
  }

  const service = getSupabaseServiceClient();
  const summary: RunSummary = { processed: 0, published: 0, retried: 0, failed: 0 };

  await processSocial(service, summary);
  await processEmail(service, summary);

  await recordAudit({
    actor: null,
    action: "scheduler_run",
    target_type: "scheduler",
    target_id: null,
    metadata: { ...summary },
  });

  return NextResponse.json({ ok: true, ...summary });
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false; // handled separately in run() -> 503
  const provided = req.headers.get("x-cron-secret") ?? "";
  return provided.length > 0 && provided === secret;
}

export async function POST(req: Request) {
  if (process.env.CRON_SECRET && !authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  return run();
}

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && !authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  return run();
}
