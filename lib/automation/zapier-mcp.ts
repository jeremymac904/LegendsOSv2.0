// Zapier MCP bridge — placeholder. The Atlas connector panel lists Zapier
// as `coming_soon` and the chat router never tries to dispatch through here
// today. Once we wire the real MCP transport this file picks up the typed
// `triggerZap` / `getZapStatus` shape so callers don't have to change.
//
// Hard rules:
//   - Never throw — return a typed `not_configured` result.
//   - Never reach out to any external service from this file yet.
//   - Server-only — never import from a client component.

export interface ZapNotConfigured {
  status: "not_configured";
  message: string;
}

export async function triggerZap(
  _zapId: string,
  _data: Record<string, unknown>
): Promise<ZapNotConfigured> {
  return {
    status: "not_configured",
    message: "Zapier MCP not yet connected",
  };
}

export async function getZapStatus(
  _runId: string
): Promise<ZapNotConfigured> {
  return {
    status: "not_configured",
    message: "Zapier MCP not yet connected",
  };
}
