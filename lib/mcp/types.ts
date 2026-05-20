// Shared MCP types for the connector foundation.
//
// MCP ("Model Context Protocol") connectors are server endpoints that expose
// tools / resources to an agent. We model two scopes in v1:
//
//   * `owner_global` — connectors that belong to the LegendsOS deployment
//     itself. Configured via Netlify env vars; status is computed from env
//     var NAME existence only (never value). Examples: n8n webhooks, Zapier
//     MCP, future Hermes-local model server, future browser-automation
//     server.
//
//   * `lo_personal` — connectors a loan officer added for themselves via
//     Settings → MCP Connections. Backed by the `mcp_connections` table with
//     RLS scoped to the owning user.
//
// `future` is a placeholder scope for connectors that are reserved in the
// registry but not yet exposed for setup.
//
// Status semantics:
//   * `connected`       — all required env / db fields are present; we COULD
//                         call this connector if executor support shipped.
//   * `disabled`        — owner-controlled toggle is off (env flag exists
//                         but is set to a falsy value).
//   * `not_configured`  — required env vars / row are missing.
//
// HARD RULE: the runtime NEVER reads env VALUES into this surface — only
// env var NAMES and a boolean for presence. The same applies to the
// `mcp_connections.auth_token` column, which is server-side-only and is
// never returned in any McpConnector or manifest payload.

export type McpScope = "owner_global" | "lo_personal" | "future";

export type McpStatus = "connected" | "disabled" | "not_configured";

export interface McpConnector {
  /** Stable identifier — lowercase snake_case. */
  id: string;
  /** Display label for UI surfaces. */
  name: string;
  /** Scope of this connector. */
  scope: McpScope;
  /** Computed live status. */
  status: McpStatus;
  /**
   * Env vars this connector requires (NAMES ONLY). The UI surfaces these
   * names so the owner knows what to add in Netlify env. For lo_personal
   * connectors this is `[]` — they live in the DB row, not env.
   */
  requiredEnv: string[];
  /**
   * Names of tools this connector would surface once execution is wired up.
   * Empty in v1 — this sprint ships STATUS SURFACING only, not live calls.
   * Reserved for the next sprint when we actually invoke MCP tools.
   */
  availableTools: string[];
  /** One-line user-facing description shown in the UI pill / Settings row. */
  description: string;
  /** Plain-English instructions for configuring this connector. */
  setupInstructions: string;
  /**
   * For lo_personal rows only — the underlying DB id (so the UI can call
   * DELETE /api/integrations/mcp?id=<id>). NEVER set for env-based rows.
   */
  rowId?: string;
  /**
   * For lo_personal rows only — has the user saved an auth_token on the
   * server side? Surface this as a boolean so the UI can show
   * "authenticated" without ever exposing the token value.
   */
  hasToken?: boolean;
  /**
   * For lo_personal rows only — the saved_at ISO timestamp so the UI can
   * show "last updated 3 days ago".
   */
  savedAt?: string | null;
  /**
   * For lo_personal rows only — provider this connection was configured as.
   */
  provider?: "zapier" | "composio" | "custom";
}

/**
 * Snapshot returned by getConnectorSnapshot(). Equivalent to McpConnector[]
 * — typed alias so callers can be explicit about the source.
 */
export type McpConnectorSnapshot = McpConnector[];

/** Combined tool + connector manifest shape returned by /api/atlas/tools. */
export interface AtlasToolManifest {
  tools: Array<{
    id: string;
    name: string;
    description: string;
    rolesAllowed: string[];
    audit: boolean;
    requiresEnv: string[];
    ready: boolean;
  }>;
  connectors: McpConnectorSnapshot;
  // Snapshot of the live-action gating flags so the UI can render an
  // accurate "I cannot publish live because ALLOW_LIVE_X is false" banner.
  // Booleans only — env var NAMES, never values.
  safety: {
    allow_live_social_publish: boolean;
    allow_live_email_send: boolean;
    allow_paid_image_generation: boolean;
    allow_paid_text_generation: boolean;
  };
}
