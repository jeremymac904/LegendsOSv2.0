// Atlas Hermes Workspace 2 — shared type contracts.
//
// IMPORTANT: This file is the single source of truth for the structured
// payloads exchanged between:
//   - app/api/ai/chat/route.ts  (writer)
//   - components/atlas/*        (reader / renderer)
//   - app/api/atlas/connectors/* (writer of AtlasConnector rows)
//
// Both the backend (Track A) and the UI (Track C) MUST import shapes from
// this file rather than redeclaring them inline. Keep this file pure-TS,
// side-effect-free, server-and-client safe.

// ---------------------------------------------------------------------------
// Router awareness — which backend produced an assistant message
// ---------------------------------------------------------------------------

/**
 * Identifies which subsystem actually generated an assistant message body.
 * Surfaced as a small chip on the message bubble so users (and Jeremy)
 * can SEE whether Atlas answered from the AI provider, from a deterministic
 * tool insert, from n8n, from a Zapier MCP, or grounded purely in knowledge.
 *
 * - `provider`  — normal AI provider chain (DeepSeek / OpenRouter / NVIDIA)
 * - `tool`     — Atlas tool router fired (draft / capability / knowledge note)
 * - `n8n`      — n8n bridge executed a workflow
 * - `zapier`   — Zapier MCP placeholder (not yet wired; returns stub)
 * - `knowledge` — pure retrieval response (no provider call needed)
 */
export type AtlasRouter = "provider" | "tool" | "n8n" | "zapier" | "knowledge";

// ---------------------------------------------------------------------------
// Planner steps — multi-step task progress indicator
// ---------------------------------------------------------------------------

export type AtlasPlanStepStatus = "queued" | "running" | "done" | "error";

export interface AtlasPlanStep {
  /** Stable id within the plan, e.g. "step-1" */
  id: string;
  /** Short human-readable label, e.g. "Draft post" */
  label: string;
  status: AtlasPlanStepStatus;
  /** Optional sub-label, error message, or hint */
  detail?: string | null;
}

// ---------------------------------------------------------------------------
// Tool result metadata — extended for Workspace 2 result-card variants
// ---------------------------------------------------------------------------

/**
 * Tool kinds the Atlas chat surface can render structured cards for. Kept in
 * sync with `AtlasToolKind` in lib/atlas/toolRouter.ts plus the new
 * Workspace 2 variants (`mortgage_calc`, `loan_comparison`, `lead_summary`,
 * `trigger_automation`).
 */
export type AtlasToolMetaKind =
  | "create_social"
  | "create_email"
  | "create_calendar"
  | "explain_capabilities"
  | "create_knowledge_note"
  | "mortgage_calc"
  | "loan_comparison"
  | "lead_summary"
  | "trigger_automation";

export interface AtlasCapabilityProviderLite {
  id: string;
  label: string;
  status: "ready" | "configured" | "disabled" | "missing";
  env_var: string;
  next_action: string | null;
}

export interface AtlasMortgageCalcPayload {
  principal: number;
  rate_pct: number;
  term_years: number;
  monthly_payment: number;
  total_interest: number;
  notes?: string | null;
}

export interface AtlasLoanComparisonOption {
  label: string;
  rate_pct: number;
  apr_pct?: number | null;
  monthly_payment: number;
  total_interest?: number | null;
  highlights?: string[];
}

export interface AtlasLoanComparisonPayload {
  principal: number;
  term_years: number;
  options: AtlasLoanComparisonOption[];
}

export interface AtlasLeadSummaryPayload {
  lead_name: string;
  status: string;
  stage?: string | null;
  next_step?: string | null;
  contact?: string | null;
  last_activity?: string | null;
}

export interface AtlasTriggerAutomationPayload {
  workflow_id: string;
  workflow_label?: string | null;
  execution_id?: string | null;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "not_configured"
    | "stub";
  message?: string | null;
}

/**
 * The structured payload stamped onto `chat_messages.metadata.tool_result`.
 * The chat client reads this and chooses the right ToolResultCard variant.
 * `kind` is required so the UI can switch deterministically.
 */
export interface AtlasToolResultMeta {
  kind: AtlasToolMetaKind;
  itemId: string;
  link: string;
  summary: string;
  title?: string | null;
  // Variant-specific payloads. Only one of these is populated per row.
  capabilities?: { providers: AtlasCapabilityProviderLite[] };
  mortgage_calc?: AtlasMortgageCalcPayload;
  loan_comparison?: AtlasLoanComparisonPayload;
  lead_summary?: AtlasLeadSummaryPayload;
  trigger_automation?: AtlasTriggerAutomationPayload;
}

// ---------------------------------------------------------------------------
// Full Atlas-message metadata blob (chat_messages.metadata)
// ---------------------------------------------------------------------------

/**
 * Everything the assistant message persists for Workspace 2 rendering.
 * Optional fields are nullable on purpose — older messages predate these
 * keys and the UI must not blow up when they're absent.
 */
export interface AtlasMessageMetadata {
  provider?: string | null;
  model?: string | null;
  /** Which backend produced this message — drives the router chip. */
  router?: AtlasRouter | null;
  /** True when knowledge retrieval grounded this answer. */
  knowledge_used?: boolean | null;
  /** Count + sources mirror what /api/ai/chat already returns. */
  knowledge_hits?: number | null;
  knowledge_sources?: { title: string; source_path: string | null }[] | null;
  /** Structured tool result for the result-card renderer. */
  tool_result?: AtlasToolResultMeta | null;
  /** Multi-step plan steps the right-rail PlannerPanel renders. */
  plan_steps?: AtlasPlanStep[] | null;
  /** Free-form source label, e.g. "atlas_capability_query". */
  source?: string | null;
}

// ---------------------------------------------------------------------------
// Atlas connector rows (Part 2 + UI panel)
// ---------------------------------------------------------------------------

export type AtlasConnectorType = "automation" | "messaging" | "mcp" | "other";

export type AtlasConnectorStatus =
  | "active"
  | "inactive"
  | "error"
  | "coming_soon";

/**
 * Mirrors a row in the new `atlas_connectors` table. Track B owns the SQL;
 * Track A's API route returns these; Track C's ConnectorPanel renders them.
 * Note: `config_json` only ever contains references to env var NAMES — never
 * values. Safe to ship to the browser.
 */
export interface AtlasConnector {
  id: string;
  name: string;
  type: AtlasConnectorType | string;
  status: AtlasConnectorStatus | string;
  config_json: Record<string, unknown>;
  owner_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Audit log surface (the AuditPanel reads this shape)
// ---------------------------------------------------------------------------

export interface AtlasAuditEntry {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
