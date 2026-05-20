/**
 * n8n MCP Bridge — Atlas tool integration for n8n workflow automation.
 *
 * Provides Atlas with the ability to trigger n8n workflows by name,
 * check execution status, and list available workflows.
 *
 * All calls are server-only. Uses N8N_API_KEY + N8N_BASE_URL from env.
 * Gracefully degrades when n8n is not configured — never throws, always
 * returns a typed result.
 */

import { getServerEnv } from "@/lib/env";

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  tags?: string[];
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: "running" | "success" | "error" | "waiting" | "unknown";
  startedAt: string | null;
  finishedAt: string | null;
  error?: string | null;
}

export interface N8nTriggerResult {
  ok: boolean;
  executionId?: string;
  message: string;
  status: "triggered" | "queued" | "not_configured" | "error";
}

export interface N8nStatusResult {
  ok: boolean;
  execution?: N8nExecution;
  status: "found" | "not_found" | "not_configured" | "error";
  message: string;
}

export interface N8nWorkflowListResult {
  ok: boolean;
  workflows: N8nWorkflow[];
  status: "listed" | "not_configured" | "error";
  message: string;
}

/**
 * Check whether the n8n API is configured in the current environment.
 * Returns false when N8N_BASE_URL or N8N_API_KEY are missing.
 */
export function isN8nConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.N8N_BASE_URL && env.N8N_API_KEY);
}

/**
 * Build n8n API base headers. Safe to call even when not configured —
 * callers should check `isN8nConfigured()` first.
 */
function n8nHeaders(): Record<string, string> {
  const env = getServerEnv();
  return {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": env.N8N_API_KEY || "",
  };
}

/**
 * Trigger an n8n workflow by its numeric or string ID.
 * Sends a POST to /api/v1/workflows/:id/activate or uses the webhook URL
 * pattern when a direct webhook trigger URL is configured.
 *
 * For Atlas tool use: provide workflowId (numeric ID from n8n) + optional payload.
 */
export async function triggerWorkflow(
  workflowId: string,
  payload: Record<string, unknown> = {}
): Promise<N8nTriggerResult> {
  if (!isN8nConfigured()) {
    return {
      ok: false,
      status: "not_configured",
      message:
        "n8n is not configured. Set N8N_BASE_URL and N8N_API_KEY in environment variables.",
    };
  }

  const env = getServerEnv();
  const baseUrl = env.N8N_BASE_URL.replace(/\/$/, "");

  try {
    // Use the n8n REST API to create a manual execution
    const res = await fetch(
      `${baseUrl}/api/v1/workflows/${workflowId}/run`,
      {
        method: "POST",
        headers: n8nHeaders(),
        body: JSON.stringify({
          workflowData: { id: workflowId },
          runData: payload,
          startNodes: [],
          destinationNode: "",
        }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: "error",
        message: `n8n returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as { executionId?: string; data?: { executionId?: string } };
    const executionId =
      data.executionId ?? data.data?.executionId ?? "unknown";

    return {
      ok: true,
      executionId,
      status: "triggered",
      message: `Workflow ${workflowId} triggered. Execution ID: ${executionId}`,
    };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      message: e instanceof Error ? e.message : "Trigger failed",
    };
  }
}

/**
 * Get the status of an n8n execution by its execution ID.
 */
export async function getWorkflowStatus(
  executionId: string
): Promise<N8nStatusResult> {
  if (!isN8nConfigured()) {
    return {
      ok: false,
      status: "not_configured",
      message: "n8n is not configured.",
    };
  }

  const env = getServerEnv();
  const baseUrl = env.N8N_BASE_URL.replace(/\/$/, "");

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/executions/${executionId}`,
      {
        method: "GET",
        headers: n8nHeaders(),
        cache: "no-store",
      }
    );

    if (res.status === 404) {
      return {
        ok: false,
        status: "not_found",
        message: `Execution ${executionId} not found in n8n.`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        message: `n8n returned ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      id?: string;
      workflowId?: string;
      status?: string;
      startedAt?: string;
      stoppedAt?: string;
      error?: { message?: string };
    };

    const execution: N8nExecution = {
      id: data.id ?? executionId,
      workflowId: data.workflowId ?? "",
      status: (data.status as N8nExecution["status"]) ?? "unknown",
      startedAt: data.startedAt ?? null,
      finishedAt: data.stoppedAt ?? null,
      error: data.error?.message ?? null,
    };

    return {
      ok: true,
      execution,
      status: "found",
      message: `Execution ${executionId} is ${execution.status}.`,
    };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      message: e instanceof Error ? e.message : "Status check failed",
    };
  }
}

/**
 * List available n8n workflows. Returns all active workflows the API key
 * can see. Used by Atlas to show available automations.
 */
export async function listAvailableWorkflows(): Promise<N8nWorkflowListResult> {
  if (!isN8nConfigured()) {
    return {
      ok: false,
      workflows: [],
      status: "not_configured",
      message: "n8n is not configured. Set N8N_BASE_URL and N8N_API_KEY.",
    };
  }

  const env = getServerEnv();
  const baseUrl = env.N8N_BASE_URL.replace(/\/$/, "");

  try {
    const res = await fetch(`${baseUrl}/api/v1/workflows?active=true`, {
      method: "GET",
      headers: n8nHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        workflows: [],
        status: "error",
        message: `n8n returned ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      data?: Array<{ id: string; name: string; active: boolean; tags?: string[] }>;
    };
    const workflows: N8nWorkflow[] = (data.data ?? []).map((w) => ({
      id: String(w.id),
      name: w.name,
      active: w.active,
      tags: w.tags,
    }));

    return {
      ok: true,
      workflows,
      status: "listed",
      message: `Found ${workflows.length} active workflow${workflows.length === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    return {
      ok: false,
      workflows: [],
      status: "error",
      message: e instanceof Error ? e.message : "List failed",
    };
  }
}
