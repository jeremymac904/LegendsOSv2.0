/**
 * Zapier MCP Connector
 *
 * Real HTTP connector for Zapier MCP integrations. Reads per-user MCP
 * connections from the DB via the service client (server-only) and calls the
 * saved URL with the stored auth token.
 *
 * Rules enforced here:
 *   - auth_token is NEVER returned to any caller — it is read server-side only.
 *   - All DB reads use the service client so RLS does not block privileged reads.
 *   - Callers only receive {ok, status, message, ...} shapes — never raw tokens.
 *
 * This file is server-only. Do not import from client components.
 */

import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface ZapierZapResult {
  ok: boolean;
  runId?: string;
  status: "triggered" | "not_configured" | "error";
  message: string;
}

export interface ZapierStatusResult {
  ok: boolean;
  runId?: string;
  zapStatus?: "pending" | "running" | "success" | "error" | "halted";
  status: "found" | "not_configured" | "error";
  message: string;
}

/**
 * Safe connection descriptor returned to callers.
 * The auth_token is intentionally omitted — server reads it internally only.
 */
export interface ZapierMcpConnectionInfo {
  id: string;
  url: string;
  label: string;
  /** True when an auth_token is stored (content never exposed to callers). */
  hasToken: boolean;
}

/**
 * Check whether Zapier MCP is configured via environment variable.
 * This covers the legacy env-key path (ZAP_MCP_KEY / ZAPIER_MCP_KEY).
 * Per-user DB connections are checked via getUserZapierMcpConnection().
 */
export function isZapierMcpConfigured(): boolean {
  return Boolean(process.env.ZAP_MCP_KEY || process.env.ZAPIER_MCP_KEY);
}

/**
 * Read the first Zapier MCP connection for a user from the DB.
 * Uses the service client so RLS is bypassed for server-side reads.
 * NEVER returns the auth_token value — only a hasToken boolean.
 */
export async function getUserZapierMcpConnection(
  userId: string
): Promise<ZapierMcpConnectionInfo | null> {
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("mcp_connections")
      .select("id, url, label, auth_token")
      .eq("user_id", userId)
      .eq("provider", "zapier")
      .order("saved_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id as string,
      url: data.url as string,
      label: data.label as string,
      // Expose only whether a token is stored — never the value itself
      hasToken: Boolean(data.auth_token),
    };
  } catch {
    return null;
  }
}

/**
 * Server-only. Reads the mcp_connections row via the service client and POSTs
 * to url+path with Authorization: Bearer <auth_token>. The token is read and
 * used exclusively on the server — never returned to any caller.
 *
 * Returns the parsed response JSON, or an error-shape object.
 */
export async function callUserMcpEndpoint(
  userId: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: string; message: string; data?: unknown }> {
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("mcp_connections")
      .select("url, auth_token")
      .eq("user_id", userId)
      .eq("provider", "zapier")
      .order("saved_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        status: "not_configured",
        message:
          "No Zapier MCP connection found. Go to Settings → Integrations to connect your Zapier account.",
      };
    }

    const baseUrl = (data.url as string).replace(/\/$/, "");
    const authToken = data.auth_token as string | null;
    const endpoint = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: "error",
        message: `MCP endpoint returned HTTP ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const responseData = await resp.json().catch(() => null);
    return {
      ok: true,
      status: "triggered",
      message: "MCP endpoint called successfully.",
      data: responseData,
    };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      message: `MCP call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Trigger a Zapier Zap by its ID.
 *
 * Priority:
 *   1. If ZAP_MCP_URL is set: POST directly to that URL.
 *   2. If ZAP_MCP_KEY or ZAPIER_MCP_KEY is set: POST to
 *      https://hooks.zapier.com/hooks/catch/{zapId} with Bearer token.
 *   3. Otherwise: return not_configured.
 */
export async function triggerZap(
  zapId: string,
  data: Record<string, unknown> = {}
): Promise<ZapierZapResult> {
  const envUrl = process.env.ZAP_MCP_URL;
  const envKey = process.env.ZAP_MCP_KEY || process.env.ZAPIER_MCP_KEY;

  if (!envUrl && !envKey) {
    return {
      ok: false,
      status: "not_configured",
      message:
        "Zapier MCP is not yet connected. Set ZAP_MCP_KEY or ZAP_MCP_URL in your environment to enable.",
    };
  }

  const targetUrl = envUrl
    ? envUrl.replace(/\/$/, "")
    : `https://hooks.zapier.com/hooks/catch/${zapId}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (envKey) {
    headers["Authorization"] = `Bearer ${envKey}`;
  }

  try {
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ zap_id: zapId, ...data }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: "error",
        message: `Zapier returned HTTP ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const result = await resp.json().catch(() => ({}));
    const runId =
      typeof result?.id === "string"
        ? result.id
        : typeof result?.run_id === "string"
          ? result.run_id
          : undefined;

    return {
      ok: true,
      runId,
      status: "triggered",
      message: "Zap triggered successfully.",
    };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      message: `Zapier call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Get the status of a Zapier Zap run by its run ID.
 * Only usable when ZAP_MCP_KEY is configured (Zapier Task History API).
 */
export async function getZapStatus(runId: string): Promise<ZapierStatusResult> {
  const envKey = process.env.ZAP_MCP_KEY || process.env.ZAPIER_MCP_KEY;
  if (!envKey) {
    return {
      ok: false,
      status: "not_configured",
      message: "Zapier MCP is not yet connected.",
    };
  }

  try {
    const resp = await fetch(
      `https://zapier.com/api/v4/task-history/${encodeURIComponent(runId)}`,
      {
        headers: { Authorization: `Bearer ${envKey}` },
      }
    );

    if (!resp.ok) {
      return {
        ok: false,
        status: "error",
        message: `Zapier status check returned HTTP ${resp.status}.`,
      };
    }

    const result = await resp.json().catch(() => ({}));
    const zapStatus = result?.status ?? "unknown";

    return {
      ok: true,
      runId,
      zapStatus: zapStatus as ZapierStatusResult["zapStatus"],
      status: "found",
      message: `Run ${runId} is ${zapStatus}.`,
    };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      message: `Zapier status check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
