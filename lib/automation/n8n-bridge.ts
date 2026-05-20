// Atlas n8n bridge — a thin, typed adapter the Atlas runtime calls when an
// intent maps to "run automation X" / "trigger workflow Y". This file is
// intentionally narrower than `lib/automation/n8n.ts`: the latter is the
// general-purpose `enqueueAutomationJob` helper used by Social / Email /
// scheduled jobs; this file is the Atlas-facing fast path that returns a
// structured result the chat surface can render directly.
//
// Hard rules:
//   - Never log env values (URLs are not logged, only "configured" / "missing").
//   - When N8N is not configured, return `not_configured` — do NOT throw.
//   - Live-action workflows are gated by ALLOW_LIVE_* flags; when off, return
//     a `stub` result instead of dispatching to n8n.
//   - All fetches wrapped in try/catch. Errors return `failed` with a message.
//   - No HMAC: simplified n8n workflows accept plain JSON.
//
// Server-only. Never import from a client component.
import { getServerEnv } from "@/lib/env";
import type { N8nWebhookKey } from "@/lib/automation/n8n";

export type N8nTriggerStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "not_configured"
  | "stub";

export interface TriggerResult {
  status: N8nTriggerStatus;
  workflow_id: string;
  workflow_label?: string | null;
  execution_id?: string | null;
  message?: string | null;
}

export interface WorkflowDescriptor {
  /** Stable id Atlas uses internally (e.g. "social_publish"). */
  id: string;
  /** Human-readable label for the result chip. */
  label: string;
  /** Webhook key in env.N8N_WEBHOOKS, when this workflow has a dedicated URL. */
  webhook_key: N8nWebhookKey | null;
  /** True when this workflow performs an outbound live action (post / send). */
  is_live_action: boolean;
  /**
   * When `is_live_action` is true, the matching ALLOW_LIVE_* env flag that
   * must be set for the bridge to actually dispatch. `null` for inspection
   * or draft-only workflows.
   */
  allow_live_flag:
    | "ALLOW_LIVE_SOCIAL_PUBLISH"
    | "ALLOW_LIVE_EMAIL_SEND"
    | null;
}

// The catalog of workflows Atlas can drive. Kept small and explicit on
// purpose — this is the audit surface for live-action gating.
const WORKFLOW_CATALOG: WorkflowDescriptor[] = [
  {
    id: "social_publish",
    label: "Publish social post",
    webhook_key: "social_publish",
    is_live_action: true,
    allow_live_flag: "ALLOW_LIVE_SOCIAL_PUBLISH",
  },
  {
    id: "facebook_post",
    label: "Publish Facebook post",
    webhook_key: "facebook_post",
    is_live_action: true,
    allow_live_flag: "ALLOW_LIVE_SOCIAL_PUBLISH",
  },
  {
    id: "instagram_post",
    label: "Publish Instagram post",
    webhook_key: "instagram_post",
    is_live_action: true,
    allow_live_flag: "ALLOW_LIVE_SOCIAL_PUBLISH",
  },
  {
    id: "gbp_post",
    label: "Publish Google Business post",
    webhook_key: "gbp_post",
    is_live_action: true,
    allow_live_flag: "ALLOW_LIVE_SOCIAL_PUBLISH",
  },
  {
    id: "youtube_post",
    label: "Publish YouTube post",
    webhook_key: "youtube_post",
    is_live_action: true,
    allow_live_flag: "ALLOW_LIVE_SOCIAL_PUBLISH",
  },
  {
    id: "email_send",
    label: "Send email campaign",
    webhook_key: "email_send",
    is_live_action: true,
    allow_live_flag: "ALLOW_LIVE_EMAIL_SEND",
  },
  {
    id: "daily_usage",
    label: "Daily usage digest",
    webhook_key: "daily_usage",
    is_live_action: false,
    allow_live_flag: null,
  },
  {
    id: "provider_health",
    label: "Provider health probe",
    webhook_key: "provider_health",
    is_live_action: false,
    allow_live_flag: null,
  },
  {
    id: "content_reminder",
    label: "Content reminder",
    webhook_key: "content_reminder",
    is_live_action: false,
    allow_live_flag: null,
  },
  {
    id: "failed_publish_recovery",
    label: "Failed publish recovery",
    webhook_key: "failed_publish_recovery",
    is_live_action: false,
    allow_live_flag: null,
  },
];

/**
 * Resolve a workflow descriptor from a free-form hint (e.g. "social publish",
 * "send email", "daily digest"). Returns `null` if no descriptor matches.
 * Pure string matching — no env reads.
 */
export function resolveWorkflow(hint: string): WorkflowDescriptor | null {
  const normalized = (hint ?? "").toLowerCase().trim();
  if (!normalized) return null;

  // Exact id match first.
  const exact = WORKFLOW_CATALOG.find((w) => w.id === normalized);
  if (exact) return exact;

  // Fuzzy substring on id OR label.
  const fuzzy = WORKFLOW_CATALOG.find(
    (w) =>
      normalized.includes(w.id.replace(/_/g, " ")) ||
      w.id.replace(/_/g, " ").includes(normalized) ||
      w.label.toLowerCase().includes(normalized)
  );
  return fuzzy ?? null;
}

/**
 * List the workflows Atlas can drive — used by `listAvailableWorkflows` and
 * by `explain_capabilities` UI surfaces. Each descriptor's status reflects
 * whether the corresponding webhook URL is configured today.
 */
export function listAvailableWorkflows(): Array<
  WorkflowDescriptor & {
    configured: boolean;
    live_allowed: boolean;
  }
> {
  const env = getServerEnv();
  const baseConfigured = Boolean(env.N8N_BASE_URL);
  return WORKFLOW_CATALOG.map((w) => {
    const url = w.webhook_key ? env.N8N_WEBHOOKS[w.webhook_key] : "";
    const configured = baseConfigured && Boolean(url);
    const liveAllowed =
      w.is_live_action && w.allow_live_flag === "ALLOW_LIVE_SOCIAL_PUBLISH"
        ? env.SAFETY.allowLiveSocialPublish
        : w.is_live_action && w.allow_live_flag === "ALLOW_LIVE_EMAIL_SEND"
        ? env.SAFETY.allowLiveEmailSend
        : !w.is_live_action;
    return {
      ...w,
      configured,
      live_allowed: liveAllowed,
    };
  });
}

interface DispatchResponseShape {
  execution_id?: string;
  executionId?: string;
  status?: string;
  message?: string;
}

/**
 * Trigger an n8n workflow by id.
 *
 * - When N8N base URL is not configured at all, returns `not_configured`.
 * - When the workflow is a live-action workflow and the matching ALLOW_LIVE_*
 *   flag is off, returns `stub` (no dispatch).
 * - When the workflow has no webhook URL, returns `not_configured`.
 * - Otherwise POSTs the payload to the webhook URL and normalizes the
 *   response into TriggerResult. Errors return `failed` with the message.
 */
export async function triggerWorkflow(
  workflowId: string,
  payload: Record<string, unknown>
): Promise<TriggerResult> {
  const env = getServerEnv();
  const descriptor = resolveWorkflow(workflowId);

  if (!descriptor) {
    return {
      status: "not_configured",
      workflow_id: workflowId,
      workflow_label: null,
      message:
        "Unknown workflow. Atlas can drive: " +
        WORKFLOW_CATALOG.map((w) => w.id).join(", "),
    };
  }

  if (!env.N8N_BASE_URL) {
    return {
      status: "not_configured",
      workflow_id: descriptor.id,
      workflow_label: descriptor.label,
      message: "N8N not configured. Set N8N_BASE_URL.",
    };
  }

  const url = descriptor.webhook_key
    ? env.N8N_WEBHOOKS[descriptor.webhook_key]
    : "";
  if (!url) {
    return {
      status: "not_configured",
      workflow_id: descriptor.id,
      workflow_label: descriptor.label,
      message: `N8N webhook URL missing for ${descriptor.id}.`,
    };
  }

  // Live-action gating — even with a webhook configured, we will not
  // dispatch unless the matching ALLOW_LIVE_* flag is on.
  if (descriptor.is_live_action) {
    const live =
      descriptor.allow_live_flag === "ALLOW_LIVE_SOCIAL_PUBLISH"
        ? env.SAFETY.allowLiveSocialPublish
        : descriptor.allow_live_flag === "ALLOW_LIVE_EMAIL_SEND"
        ? env.SAFETY.allowLiveEmailSend
        : false;
    if (!live) {
      return {
        status: "stub",
        workflow_id: descriptor.id,
        workflow_label: descriptor.label,
        message: `Live publish gated by ${descriptor.allow_live_flag ?? "ALLOW_LIVE_*"} flag.`,
      };
    }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow_id: descriptor.id, ...payload }),
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: DispatchResponseShape | null = null;
    try {
      parsed = text ? (JSON.parse(text) as DispatchResponseShape) : null;
    } catch {
      // n8n workflows sometimes return plain "OK" — fine.
      parsed = null;
    }
    if (!res.ok) {
      return {
        status: "failed",
        workflow_id: descriptor.id,
        workflow_label: descriptor.label,
        message: `n8n ${res.status}: ${(parsed?.message ?? text).slice(0, 240)}`,
      };
    }
    const executionId = parsed?.execution_id ?? parsed?.executionId ?? null;
    // n8n responses don't always include a status field — default to queued
    // when the POST succeeded but no explicit status came back.
    const normalizedStatus: N8nTriggerStatus =
      parsed?.status === "succeeded" ||
      parsed?.status === "running" ||
      parsed?.status === "failed" ||
      parsed?.status === "queued"
        ? (parsed.status as N8nTriggerStatus)
        : "queued";
    return {
      status: normalizedStatus,
      workflow_id: descriptor.id,
      workflow_label: descriptor.label,
      execution_id: executionId,
      message: parsed?.message ?? null,
    };
  } catch (err) {
    return {
      status: "failed",
      workflow_id: descriptor.id,
      workflow_label: descriptor.label,
      message: err instanceof Error ? err.message : "dispatch failed",
    };
  }
}

/**
 * Look up an n8n execution by id. Not all workflows expose a status endpoint;
 * when N8N_API_KEY + base URL are not set, returns `not_configured` so the
 * caller can render a benign chip instead of an error.
 *
 * We deliberately avoid making this a hard requirement — the chat surface
 * shows the most recent TriggerResult.status; this helper is only used by
 * the audit / connector panels for refresh.
 */
export async function getWorkflowStatus(
  executionId: string
): Promise<TriggerResult> {
  const env = getServerEnv();
  if (!env.N8N_BASE_URL || !env.N8N_API_KEY) {
    return {
      status: "not_configured",
      workflow_id: executionId,
      workflow_label: null,
      message: "N8N status lookup unavailable (missing N8N_API_KEY).",
    };
  }
  const url = `${env.N8N_BASE_URL.replace(/\/+$/, "")}/api/v1/executions/${encodeURIComponent(
    executionId
  )}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-N8N-API-KEY": env.N8N_API_KEY,
        accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        status: "failed",
        workflow_id: executionId,
        execution_id: executionId,
        message: `n8n ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    let parsed: { finished?: boolean; status?: string } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    const status: N8nTriggerStatus = parsed.finished
      ? parsed.status === "error"
        ? "failed"
        : "succeeded"
      : "running";
    return {
      status,
      workflow_id: executionId,
      execution_id: executionId,
      message: null,
    };
  } catch (err) {
    return {
      status: "failed",
      workflow_id: executionId,
      execution_id: executionId,
      message: err instanceof Error ? err.message : "status lookup failed",
    };
  }
}
