/**
 * Zapier MCP Placeholder
 *
 * Stub connector for the Zapier MCP integration. All functions return a
 * "not_configured" shape so the system behaves gracefully before Zapier is
 * connected. Replace these implementations when the Zapier MCP key is set.
 *
 * This file is server-only. Do not import from client components.
 */

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
 * Trigger a Zapier Zap by its ID.
 * Currently returns "not_configured" — implement when ZAP_MCP_KEY is set.
 */
export async function triggerZap(
  _zapId: string,
  _data: Record<string, unknown> = {}
): Promise<ZapierZapResult> {
  return {
    ok: false,
    status: "not_configured",
    message:
      "Zapier MCP is not yet connected. Coming soon — set ZAP_MCP_KEY in your environment to enable.",
  };
}

/**
 * Get the status of a Zapier Zap run by its run ID.
 * Currently returns "not_configured" — implement when ZAP_MCP_KEY is set.
 */
export async function getZapStatus(
  _runId: string
): Promise<ZapierStatusResult> {
  return {
    ok: false,
    status: "not_configured",
    message: "Zapier MCP is not yet connected.",
  };
}

/**
 * Check whether Zapier MCP is configured in the current environment.
 */
export function isZapierMcpConfigured(): boolean {
  return Boolean(process.env.ZAP_MCP_KEY || process.env.ZAPIER_MCP_KEY);
}
