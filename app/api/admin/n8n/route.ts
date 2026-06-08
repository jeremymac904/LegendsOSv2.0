import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  enqueueAutomationJob,
  getN8nConfigState,
  getWebhookUrl,
  isN8nCallbackSecretConfigured,
  type N8nWebhookKey,
} from "@/lib/automation/n8n";
import {
  buildN8nWebhookStatuses,
  inferN8nWebhookKey,
  listLocalN8nWorkflows,
  summarizeDispatchLog,
  summarizeN8nJob,
} from "@/lib/automation/n8n-control";
import {
  isN8nConfigured,
  listAvailableWorkflows,
} from "@/lib/automation/n8n-bridge";
import { isN8nDispatchAllowed } from "@/lib/integrations/liveSettings";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import { isAdminOrOwner } from "@/lib/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { Profile } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Columns we surface in the recent-jobs feed (no payload — may contain PII).
const JOB_SELECT =
  "id,user_id,organization_id,job_type,module,target_table,target_id,status,attempts,webhook_url,scheduled_at,created_at,updated_at,started_at,completed_at,last_error";

const RETRY_JOB_SELECT = `${JOB_SELECT},payload`;

const LOG_ACTIONS = [
  "n8n_job_retried",
  "n8n_retry_blocked",
  "n8n_retry_queued",
  "social_publish_requested",
  "email_send_requested",
  "email_test_requested",
  "email_test_send_dispatched",
  "cron_process_scheduled",
];

const SOCIAL_CHANNEL_PLATFORM: Record<string, string[]> = {
  facebook: ["facebook"],
  instagram: ["instagram"],
  google_business_profile: ["google_business_profile"],
  youtube: ["youtube"],
};

type RetryJobRow = Record<string, unknown>;

function retryActorFor(row: RetryJobRow, fallback: Profile): Profile {
  return {
    ...fallback,
    id: typeof row.user_id === "string" ? row.user_id : fallback.id,
    organization_id:
      typeof row.organization_id === "string"
        ? row.organization_id
        : fallback.organization_id,
  };
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function socialDestinationsEnabled(row: RetryJobRow): Promise<boolean> {
  const payload = payloadObject(row.payload);
  let channels = Array.isArray(payload.channels)
    ? payload.channels.filter((channel): channel is string => typeof channel === "string")
    : [];

  if (channels.length === 0 && row.target_table === "social_posts" && row.target_id) {
    try {
      const service = getSupabaseServiceClient();
      const { data } = await service
        .from("social_posts")
        .select("channels")
        .eq("id", row.target_id)
        .maybeSingle();
      const postChannels = (data as { channels?: unknown } | null)?.channels;
      channels = Array.isArray(postChannels)
        ? postChannels.filter((channel): channel is string => typeof channel === "string")
        : [];
    } catch {
      return false;
    }
  }

  if (channels.length === 0) return false;

  const platformKeys = Array.from(
    new Set(channels.flatMap((channel) => SOCIAL_CHANNEL_PLATFORM[channel] ?? [channel]))
  );

  try {
    const service = getSupabaseServiceClient();
    let query = service
      .from("social_account_connections")
      .select("platform,status,is_publish_enabled")
      .in("platform", platformKeys);
    if (typeof row.user_id === "string") query = query.eq("user_id", row.user_id);
    if (typeof row.organization_id === "string") {
      query = query.eq("organization_id", row.organization_id);
    }
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return false;
    const enabled = new Set(
      data
        .filter(
          (item) =>
            (item as { status?: string }).status === "connected" &&
            Boolean((item as { is_publish_enabled?: boolean }).is_publish_enabled)
        )
        .map((item) => String((item as { platform: string }).platform))
    );
    return channels.every((channel) =>
      (SOCIAL_CHANNEL_PLATFORM[channel] ?? [channel]).some((platform) =>
        enabled.has(platform)
      )
    );
  } catch {
    return false;
  }
}

async function resolveRetryDispatch(args: {
  profile: Profile;
  row: RetryJobRow;
  webhookKey: N8nWebhookKey;
}): Promise<{ dispatch: boolean; reason: string }> {
  if (!getWebhookUrl(args.webhookKey)) {
    return { dispatch: false, reason: "no_webhook_configured" };
  }

  const organizationId =
    typeof args.row.organization_id === "string"
      ? args.row.organization_id
      : args.profile.organization_id;
  const n8nAllowed = await isN8nDispatchAllowed(organizationId);
  if (!n8nAllowed) {
    return { dispatch: false, reason: "n8n_dispatch_disabled" };
  }

  const userId =
    typeof args.row.user_id === "string" ? args.row.user_id : args.profile.id;
  if (args.webhookKey === "email_send") {
    const live = await resolveLiveAction("email", { organizationId, userId });
    return {
      dispatch: live.allowed,
      reason: live.allowed ? "ok" : `live_email_${live.reason}`,
    };
  }

  if (args.webhookKey === "social_publish") {
    const live = await resolveLiveAction("social", { organizationId, userId });
    if (!live.allowed) {
      return { dispatch: false, reason: `live_social_${live.reason}` };
    }
    const destinationsEnabled = await socialDestinationsEnabled(args.row);
    return {
      dispatch: destinationsEnabled,
      reason: destinationsEnabled ? "ok" : "social_destination_not_enabled",
    };
  }

  return { dispatch: false, reason: "manual_retry_queues_system_job" };
}

// ---------------------------------------------------------------------------
// GET — owner-only status + recent jobs
// ---------------------------------------------------------------------------
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isAdminOrOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner/admin only." },
      { status: 403 }
    );
  }

  // Config state (booleans only — no secrets)
  const apiConfigured = isN8nConfigured();
  const webhookConfig = getN8nConfigState();
  const n8nDispatchAllowed = await isN8nDispatchAllowed(profile.organization_id);
  const config = {
    ...webhookConfig,
    api_key_present: Boolean(process.env.N8N_API_KEY),
    hmac_secret_present: isN8nCallbackSecretConfigured(),
    n8n_dispatch_allowed: n8nDispatchAllowed,
  };

  // Workflow list — degrade to [] when unconfigured
  const workflowResult = await listAvailableWorkflows();
  const workflows = workflowResult.workflows ?? [];
  const localWorkflows = listLocalN8nWorkflows();
  const webhookStatus = buildN8nWebhookStatuses();

  // Recent jobs — degrade to [] on missing table / bad service key
  let recentJobs: unknown[] = [];
  let dispatchLogs: unknown[] = [];
  let credentialPresence: Record<string, unknown> | null = null;
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("automation_jobs")
      .select(JOB_SELECT)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && Array.isArray(data)) {
      recentJobs = data.map((row) => summarizeN8nJob(row as Record<string, unknown>));
    }

    const { data: logs, error: logsError } = await service
      .from("audit_logs")
      .select("id,action,target_type,target_id,metadata,created_at")
      .in("action", LOG_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(25);
    if (!logsError && Array.isArray(logs)) {
      dispatchLogs = logs.map((row) =>
        summarizeDispatchLog(row as Record<string, unknown>)
      );
    }

    const { data: providerRow, error: providerError } = await service
      .from("provider_credentials_public")
      .select("provider,status,env_var_name,is_enabled,updated_at")
      .eq("provider", "n8n")
      .maybeSingle();
    if (!providerError && providerRow) {
      const row = providerRow as {
        provider: string;
        status: string | null;
        env_var_name: string | null;
        is_enabled: boolean | null;
        updated_at: string | null;
      };
      credentialPresence = {
        provider: row.provider,
        stored_status: row.status,
        env_var_name: row.env_var_name,
        is_enabled: row.is_enabled,
        updated_at: row.updated_at,
      };
    }
  } catch {
    // Table absent or service key missing — degrade silently
  }

  return NextResponse.json({
    ok: true,
    configured: apiConfigured || webhookConfig.configured,
    api_configured: apiConfigured,
    workflow_list_status: workflowResult.status,
    workflow_list_message: workflowResult.message,
    config,
    webhookStatus,
    workflows,
    localWorkflows,
    recentJobs,
    dispatchLogs,
    credentialPresence,
  });
}

// ---------------------------------------------------------------------------
// POST — owner-only actions
// ---------------------------------------------------------------------------
const PostBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("retry_job"),
    job_id: z.string(),
  }),
]);

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isAdminOrOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner/admin only." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = PostBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", message: parsed.error.message },
      { status: 422 }
    );
  }
  const data = parsed.data;

  // ---- retry_job ----------------------------------------------------------
  if (data.action === "retry_job") {
    let jobRow: RetryJobRow | null = null;
    try {
      const service = getSupabaseServiceClient();
      const { data: row, error } = await service
        .from("automation_jobs")
        .select(RETRY_JOB_SELECT)
        .eq("id", data.job_id)
        .maybeSingle();
      if (error || !row) {
        return NextResponse.json(
          { ok: false, error: "not_found", message: "Job not found." },
          { status: 404 }
        );
      }
      jobRow = row as unknown as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { ok: false, error: "server_error", message: "Could not read job." },
        { status: 500 }
      );
    }

    if (String(jobRow.status ?? "") !== "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: "bad_status",
          message: "Only failed automation jobs can be retried here.",
        },
        { status: 409 }
      );
    }

    const webhookKey = inferN8nWebhookKey(jobRow);
    if (!webhookKey) {
      await recordAudit({
        actor: profile,
        action: "n8n_retry_blocked",
        target_type: "automation_job",
        target_id: data.job_id,
        metadata: { reason: "webhook_key_unknown" },
      });
      return NextResponse.json(
        {
          ok: false,
          error: "not_retryable",
          message: "Could not infer a safe n8n webhook key for this job.",
        },
        { status: 409 }
      );
    }

    const dispatchGate = await resolveRetryDispatch({
      profile,
      row: jobRow,
      webhookKey,
    });

    const enqueueResult = await enqueueAutomationJob({
      profile: retryActorFor(jobRow, profile),
      job_type: String(jobRow.job_type ?? "retry"),
      module: String(jobRow.module ?? "admin"),
      target_table:
        typeof jobRow.target_table === "string" ? jobRow.target_table : undefined,
      target_id: typeof jobRow.target_id === "string" ? jobRow.target_id : undefined,
      webhook_key: webhookKey,
      payload: {
        ...payloadObject(jobRow.payload),
        retry_of: data.job_id,
        retried_by: profile.id,
      },
      scheduled_at:
        typeof jobRow.scheduled_at === "string" ? jobRow.scheduled_at : null,
      dispatch: dispatchGate.dispatch,
    });

    await recordAudit({
      actor: profile,
      action: "n8n_job_retried",
      target_type: "automation_job",
      target_id: data.job_id,
      metadata: {
        new_job_id: enqueueResult.job_id,
        status: enqueueResult.status,
        dispatch: dispatchGate.dispatch,
        reason: dispatchGate.reason,
      },
    });

    return NextResponse.json({
      ok: enqueueResult.status === "sent" || enqueueResult.status === "queued",
      original_job_id: data.job_id,
      new_job_id: enqueueResult.job_id,
      status: enqueueResult.status,
      reason: enqueueResult.reason,
      dispatch: dispatchGate.dispatch,
      dispatch_reason: dispatchGate.reason,
    });
  }

  // Should never reach here — discriminated union is exhaustive
  return NextResponse.json(
    { ok: false, error: "bad_request", message: "Unknown action." },
    { status: 400 }
  );
}
