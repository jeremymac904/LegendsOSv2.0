// MCP connector registry — central catalog of every connector LegendsOS
// knows about. Two scopes:
//
//   * Owner-global (L1) — declared in code below. Status is computed at
//     read time by checking env var NAME existence (never value).
//
//   * LO-personal (L2) — sourced from the `mcp_connections` table. RLS in
//     Supabase keeps the row scoped to the owning user; the registry never
//     surfaces the `auth_token` column — just a `hasToken` boolean.
//
// This module is server-only. It uses `process.env` directly and is safe to
// import from server components / API routes / runtime handlers.

import type {
  McpConnector,
  McpConnectorSnapshot,
  McpStatus,
} from "@/lib/mcp/types";
import type { SupabaseServerClient } from "@/lib/atlas/runtime-types";

// ---------------------------------------------------------------------------
// L1 — Owner-global connectors
// ---------------------------------------------------------------------------
//
// Each entry declares:
//   * id / name
//   * the env var NAMES that must all be set for status='connected'
//   * an optional disable-flag env name. If present and falsy => status='disabled'.
//   * a user-facing description + setupInstructions
//
// Status is computed by checkOwnerGlobalStatus() — env var NAMES only.

interface OwnerGlobalDef {
  id: string;
  name: string;
  /** All required env var names must be set (non-empty) for "connected". */
  requiredEnv: string[];
  /**
   * Optional owner-controlled toggle env name. If this env exists and is
   * set to a falsy value (0/false/no/off), status flips to "disabled".
   * If the env is unset, the connector is treated as enabled (default-on).
   */
  disableFlagEnv?: string;
  /** Reserved for the future MCP execution sprint. */
  availableTools: string[];
  description: string;
  setupInstructions: string;
  /** When true, this connector is shown but not actually wired up yet. */
  futurePlaceholder?: boolean;
}

const OWNER_GLOBAL_DEFS: OwnerGlobalDef[] = [
  {
    id: "n8n",
    name: "n8n",
    requiredEnv: ["N8N_BASE_URL"],
    availableTools: [],
    description:
      "n8n webhook hub. Owns outbound social publish + email send when ALLOW_LIVE_* flags are on.",
    setupInstructions:
      "Set N8N_BASE_URL (and at least one N8N_WEBHOOK_* env) in Netlify env, then redeploy.",
  },
  {
    id: "zapier_mcp",
    name: "Zapier MCP",
    // Zapier MCP isn't wired into the runtime yet — we only check for the
    // presence of the placeholder env (`ZAPIER_MCP_URL`). The handoff doc
    // says a Zapier key was received but the integration is deferred.
    requiredEnv: ["ZAPIER_MCP_URL"],
    availableTools: [],
    description:
      "Owner-global Zapier MCP server. Will surface Zapier-defined tools once execution is wired up.",
    setupInstructions:
      "Set ZAPIER_MCP_URL (and optionally ZAPIER_MCP_API_KEY) in Netlify env. Execution support ships in a follow-up sprint.",
    futurePlaceholder: true,
  },
  {
    id: "hermes_local",
    name: "Hermes Local",
    requiredEnv: ["HERMES_LOCAL_URL"],
    availableTools: [],
    description:
      "Local Hermes model server. Reserved for owner-only experiments — not wired up yet.",
    setupInstructions:
      "Configure HERMES_LOCAL_URL when the local model server is ready. Execution support ships in a follow-up sprint.",
    futurePlaceholder: true,
  },
  {
    id: "browser_playwright",
    name: "Browser (Playwright)",
    requiredEnv: ["BROWSER_AUTOMATION_ENABLED"],
    availableTools: [],
    description:
      "Browser-automation MCP for inspection tasks. Reserved — no execution this sprint.",
    setupInstructions:
      "Set BROWSER_AUTOMATION_ENABLED=true once the browser MCP container is hosted. Owner-only.",
    futurePlaceholder: true,
  },
];

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function envIsFalsy(name: string): boolean {
  // Treat unset as "not falsy" — we want unset env => default-on.
  const raw = process.env[name];
  if (raw === undefined || raw === "") return false;
  return ["0", "false", "no", "off"].includes(raw.toLowerCase());
}

function computeOwnerGlobalStatus(def: OwnerGlobalDef): McpStatus {
  const allEnvSet = def.requiredEnv.every(envPresent);
  if (!allEnvSet) return "not_configured";
  if (def.disableFlagEnv && envIsFalsy(def.disableFlagEnv)) return "disabled";
  return "connected";
}

/**
 * Synchronous read of L1 connectors. No DB calls. Status is purely a
 * function of env var NAME existence.
 */
export function listOwnerGlobalConnectors(): McpConnectorSnapshot {
  return OWNER_GLOBAL_DEFS.map<McpConnector>((d) => ({
    id: d.id,
    name: d.name,
    scope: d.futurePlaceholder ? "future" : "owner_global",
    status: computeOwnerGlobalStatus(d),
    requiredEnv: d.requiredEnv,
    availableTools: d.availableTools,
    description: d.description,
    setupInstructions: d.setupInstructions,
  }));
}

// ---------------------------------------------------------------------------
// L2 — LO-personal connectors (mcp_connections table)
// ---------------------------------------------------------------------------

interface McpConnectionRow {
  id: string;
  label: string;
  url: string;
  provider: "zapier" | "composio" | "custom";
  saved_at: string | null;
  auth_token?: string | null;
}

const MCP_TABLE = "mcp_connections";

/**
 * Read the current user's `mcp_connections` rows via the RLS-scoped server
 * client. We SELECT exactly the columns the UI needs and derive `hasToken`
 * server-side — the auth_token VALUE never crosses the JSON boundary.
 *
 * If `supabase` is null (e.g. called from a public surface), this returns
 * an empty array.
 */
export async function listLoPersonalConnectors(
  supabase: SupabaseServerClient | null
): Promise<McpConnectorSnapshot> {
  if (!supabase) return [];
  // Note: RLS in the migration scopes this read to `auth.uid() = user_id`.
  // We deliberately read `auth_token` only to compute the boolean — the
  // value is dropped before the row leaves the function.
  const { data, error } = await supabase
    .from(MCP_TABLE)
    .select("id,label,url,provider,saved_at,auth_token")
    .order("saved_at", { ascending: false });
  if (error) {
    console.error("listLoPersonalConnectors db_error", error.message);
    return [];
  }
  const rows = (data ?? []) as McpConnectionRow[];
  return rows.map<McpConnector>((row) => ({
    id: `lo_personal_${row.id}`,
    name: row.label,
    scope: "lo_personal",
    // Saved rows are treated as "connected" — Hermes-style execution
    // ships in a follow-up sprint, so we have no live probe to flip a row
    // to "disabled". A future migration can add an `enabled` column.
    status: "connected",
    requiredEnv: [],
    availableTools: [],
    description: `${row.provider} MCP server (${truncateUrl(row.url)}).`,
    setupInstructions:
      "Manage from Settings → MCP Connections. The auth token is stored server-side and never sent to the browser.",
    rowId: row.id,
    hasToken: Boolean(row.auth_token && row.auth_token.length > 0),
    savedAt: row.saved_at,
    provider: row.provider,
  }));
}

function truncateUrl(url: string): string {
  if (url.length <= 48) return url;
  return `${url.slice(0, 36)}…${url.slice(-8)}`;
}
