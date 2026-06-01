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
  isN8nConfigured,
  listAvailableWorkflows,
  triggerWorkflow,
} from "@/lib/automation/n8n-bridge";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Columns we surface in the recent-jobs feed (no payload — may contain PII).
const JOB_SELECT =
  "id,job_type,webhook_key,status,created_at,dispatched_at,completed_at,last_error";

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
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner only." },
      { status: 403 }
    );
  }

  // Config state (booleans only — no secrets)
  const configured = isN8nConfigured();
  const config = {
    ...getN8nConfigState(),
    api_key_present: Boolean(process.env.N8N_API_KEY),
    hmac_secret_present: isN8nCallbackSecretConfigured(),
  };

  // Workflow list — degrade to [] when unconfigured
  const workflowResult = await listAvailableWorkflows();
  const workflows = workflowResult.workflows ?? [];

  // Recent jobs — degrade to [] on missing table / bad service key
  let recentJobs: unknown[] = [];
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("automation_jobs")
      .select(JOB_SELECT)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && Array.isArray(data)) {
      recentJobs = data;
    }
  } catch {
    // Table absent or service key missing — degrade silently
  }

  return NextResponse.json({
    ok: true,
    configured,
    config,
    workflows,
    recentJobs,
  });
}

// ---------------------------------------------------------------------------
// POST — owner-only actions
// ---------------------------------------------------------------------------
const PostBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test_webhook"),
    webhook_key: z.string(),
  }),
  z.object({
    action: z.literal("trigger_workflow"),
    workflow_name: z.string(),
    payload: z.record(z.unknown()).optional(),
  }),
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
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner only." },
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

  // ---- test_webhook -------------------------------------------------------
  if (data.action === "test_webhook") {
    const webhookKey = data.webhook_key as N8nWebhookKey;
    const url = getWebhookUrl(webhookKey);
    if (!url) {
      return NextResponse.json({
        ok: false,
        status: "not_configured",
        message: `No URL configured for webhook key "${webhookKey}".`,
      });
    }
    let statusCode: number | null = null;
    let responseBody = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true, source: "legendsos_test" }),
        cache: "no-store",
      });
      statusCode = res.status;
      responseBody = await res.text().catch(() => "");
    } catch (e) {
      await recordAudit({
        actor: profile,
        action: "n8n_webhook_test",
        target_type: "webhook_key",
        target_id: webhookKey,
        metadata: { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      });
      return NextResponse.json({
        ok: false,
        status: "error",
        message: e instanceof Error ? e.message : "Fetch failed",
      });
    }

    await recordAudit({
      actor: profile,
      action: "n8n_webhook_test",
      target_type: "webhook_key",
      target_id: webhookKey,
      metadata: { status_code: statusCode },
    });

    return NextResponse.json({
      ok: statusCode >= 200 && statusCode < 300,
      status_code: statusCode,
      // Trim response body — never expose full payload in audit trail
      response_preview: responseBody.slice(0, 200),
    });
  }

  // ---- trigger_workflow ---------------------------------------------------
  if (data.action === "trigger_workflow") {
    const result = await triggerWorkflow(
      data.workflow_name,
      (data.payload as Record<string, unknown>) ?? {}
    );

    await recordAudit({
      actor: profile,
      action: "n8n_workflow_triggered",
      target_type: "workflow",
      target_id: data.workflow_name,
      metadata: {
        ok: result.ok,
        status: result.status,
        execution_id: result.executionId ?? null,
      },
    });

    return NextResponse.json(result);
  }

  // ---- retry_job ----------------------------------------------------------
  if (data.action === "retry_job") {
    let jobRow: Record<string, unknown> | null = null;
    try {
      const service = getSupabaseServiceClient();
      const { data: row, error } = await service
        .from("automation_jobs")
        .select(JOB_SELECT + ",module,webhook_key,payload")
        .eq("id", data.job_id)
        .maybeSingle();
      if (error || !row) {
        return NextResponse.json(
          { ok: false, error: "not_found", message: "Job not found." },
          { status: 404 }
        );
      }
      jobRow = row as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { ok: false, error: "server_error", message: "Could not read job." },
        { status: 500 }
      );
    }

    const enqueueResult = await enqueueAutomationJob({
      profile,
      job_type: String(jobRow.job_type ?? "retry"),
      module: String(jobRow.module ?? "admin"),
      webhook_key: jobRow.webhook_key
        ? (jobRow.webhook_key as N8nWebhookKey)
        : undefined,
      payload: (jobRow.payload as Record<string, unknown>) ?? {},
      dispatch: true,
    });

    await recordAudit({
      actor: profile,
      action: "n8n_job_retried",
      target_type: "automation_job",
      target_id: data.job_id,
      metadata: {
        new_job_id: enqueueResult.job_id,
        status: enqueueResult.status,
      },
    });

    return NextResponse.json({
      ok: enqueueResult.status === "sent" || enqueueResult.status === "queued",
      original_job_id: data.job_id,
      new_job_id: enqueueResult.job_id,
      status: enqueueResult.status,
      reason: enqueueResult.reason,
    });
  }

  // Should never reach here — discriminated union is exhaustive
  return NextResponse.json(
    { ok: false, error: "bad_request", message: "Unknown action." },
    { status: 400 }
  );
}
