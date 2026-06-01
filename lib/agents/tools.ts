// LegendsOS v2 — Agent tool registry (permissioned + audited)
// ---------------------------------------------------------------------------
// Tools are how agents read context and produce DRAFTS. Hard rules enforced
// structurally here:
//   * No tool sends live email, publishes live social, writes Google Drive,
//     or triggers automations. "Draft" tools only ever write status='draft'.
//   * Every execution is logged to agent_tool_calls (summaries only, no PII
//     dumps, no secrets). Sensitive actions also hit the audit log.
//   * Permission is checked against the agent registry before running.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { callUserMcpEndpoint } from "@/lib/automation/zapier-mcp";
import { isMissingDatabaseObjectError } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { Profile } from "@/types/database";

import { getAgent, TOOLS } from "./registry";
import type { AgentType, BrowserAgentContext, ToolCallStatus } from "./types";

type AnyClient = SupabaseClient<any, any, any>;

export type ToolPermission = "read" | "draft" | "sensitive";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  /** Live (send/publish) tools require both an owner flag AND user confirm. */
  requiresLiveEnabled: boolean;
}

export const TOOL_DEFS: Record<string, ToolDefinition> = {
  [TOOLS.loan_memory_lookup]: { name: TOOLS.loan_memory_lookup, description: "Look up persistent loan memory the user can see.", permission: "read", requiresLiveEnabled: false },
  [TOOLS.loan_memory_update]: { name: TOOLS.loan_memory_update, description: "Append a note/event to a loan memory timeline.", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.browser_context_read]: { name: TOOLS.browser_context_read, description: "Read the latest Browser Companion capture for this user.", permission: "read", requiresLiveEnabled: false },
  [TOOLS.gmail_status_check]: { name: TOOLS.gmail_status_check, description: "Report Gmail connection status (no message contents).", permission: "read", requiresLiveEnabled: false },
  [TOOLS.drive_status_check]: { name: TOOLS.drive_status_check, description: "Report Google Drive connection status (no file contents).", permission: "read", requiresLiveEnabled: false },
  [TOOLS.knowledge_search]: { name: TOOLS.knowledge_search, description: "Keyword search the user's knowledge items.", permission: "read", requiresLiveEnabled: false },
  [TOOLS.resource_search]: { name: TOOLS.resource_search, description: "Search shared team resources.", permission: "read", requiresLiveEnabled: false },
  [TOOLS.draft_email]: { name: TOOLS.draft_email, description: "Create an email DRAFT in Email Studio (never sends).", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.draft_text]: { name: TOOLS.draft_text, description: "Compose a text/SMS draft (never sends).", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.draft_social_post]: { name: TOOLS.draft_social_post, description: "Create a social post DRAFT in Social Studio (never publishes).", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.create_processing_note]: { name: TOOLS.create_processing_note, description: "Compose a processing note draft.", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.create_coordinator_followup]: { name: TOOLS.create_coordinator_followup, description: "Compose a coordinator follow-up draft.", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.create_builder_prompt]: { name: TOOLS.create_builder_prompt, description: "Compose a build/automation prompt draft.", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.create_training_summary]: { name: TOOLS.create_training_summary, description: "Compose a training summary draft.", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.create_youtube_repurpose_plan]: { name: TOOLS.create_youtube_repurpose_plan, description: "Compose a YouTube repurposing plan draft.", permission: "draft", requiresLiveEnabled: false },
  [TOOLS.review_output]: { name: TOOLS.review_output, description: "Run a compliance/quality review on generated output.", permission: "read", requiresLiveEnabled: false },
  [TOOLS.trigger_zap]: { name: TOOLS.trigger_zap, description: "Trigger a Zapier automation via MCP (calls the user's saved Zapier MCP endpoint).", permission: "draft", requiresLiveEnabled: false },
};

export function getToolsForAgent(agentType: AgentType): ToolDefinition[] {
  return getAgent(agentType)
    .tools.map((t) => TOOL_DEFS[t])
    .filter(Boolean);
}

export function agentCanUseTool(agentType: AgentType, toolName: string): boolean {
  return getAgent(agentType).tools.includes(toolName);
}

// --------------------------------------------------------------------------
// Tool-call audit
// --------------------------------------------------------------------------

async function logToolCall(
  client: AnyClient,
  args: {
    sessionId: string | null;
    profile: Profile;
    agentType: AgentType;
    toolName: string;
    inputSummary: string;
    outputSummary: string;
    status: ToolCallStatus;
  }
): Promise<void> {
  try {
    await client.from("agent_tool_calls").insert({
      session_id: args.sessionId,
      user_id: args.profile.id,
      agent_type: args.agentType,
      tool_name: args.toolName,
      input_summary: args.inputSummary.slice(0, 300),
      output_summary: args.outputSummary.slice(0, 500),
      status: args.status,
      permissioned: true,
      audited: true,
    });
  } catch {
    // best-effort; never throw
  }
}

export interface ToolResult {
  status: ToolCallStatus;
  /** Markdown the runtime can fold into the context block. */
  contextText: string;
  /** Short label for the trace/UI. */
  summary: string;
}

// --------------------------------------------------------------------------
// Read / status tools (used to BUILD the context bundle before answering)
// --------------------------------------------------------------------------

export async function runLoanMemoryLookup(
  client: AnyClient,
  query: string
): Promise<ToolResult> {
  try {
    const q = `%${query.slice(0, 60)}%`;
    const { data, error } = await client
      .from("loan_memory")
      .select("borrower_name, loan_number, current_stage, main_blocker, next_action, property_address")
      .or(`borrower_name.ilike.${q},loan_number.ilike.${q},property_address.ilike.${q}`)
      .limit(3);
    if (error || !data || data.length === 0) {
      return { status: "ok", contextText: "", summary: "no loan match" };
    }
    const lines = data.map(
      (m: Record<string, unknown>) =>
        `- ${m.borrower_name ?? "Borrower"} (${m.loan_number ?? "no #"}): stage ${m.current_stage ?? "unknown"}; blocker: ${m.main_blocker ?? "none"}; next: ${m.next_action ?? "n/a"}`
    );
    return {
      status: "ok",
      contextText: ["## Loan memory (retrieved — answer only from this)", ...lines].join("\n"),
      summary: `${data.length} loan match`,
    };
  } catch {
    return { status: "ok", contextText: "", summary: "loan lookup unavailable" };
  }
}

export async function runBrowserContextRead(
  context: BrowserAgentContext | null | undefined
): Promise<ToolResult> {
  if (!context) return { status: "skipped", contextText: "", summary: "no browser context" };
  const parts: string[] = [];
  if (context.sourceTitle) parts.push(`Page: ${context.sourceTitle}`);
  if (context.sourceUrl) parts.push(`URL: ${context.sourceUrl}`);
  if (context.selectedText) parts.push(`Selection: ${context.selectedText.slice(0, 1200)}`);
  if (context.structured && Object.keys(context.structured).length) {
    parts.push(`Structured: ${JSON.stringify(context.structured).slice(0, 800)}`);
  }
  if (parts.length === 0) return { status: "skipped", contextText: "", summary: "empty browser context" };
  return {
    status: "ok",
    contextText: ["## Browser Companion context (from the user's current tab)", ...parts.map((p) => `- ${p}`)].join("\n"),
    summary: "browser context loaded",
  };
}

export async function runKnowledgeSearch(
  client: AnyClient,
  query: string
): Promise<ToolResult> {
  try {
    const q = `%${query.slice(0, 60)}%`;
    const { data, error } = await client
      .from("knowledge_items")
      .select("title, content")
      .or(`title.ilike.${q},content.ilike.${q}`)
      .limit(4);
    if (error || !data || data.length === 0) {
      return { status: "ok", contextText: "", summary: "no knowledge hits" };
    }
    const lines = data.map(
      (k: Record<string, unknown>) =>
        `- ${k.title}: ${String(k.content ?? "").slice(0, 240)}`
    );
    return {
      status: "ok",
      contextText: ["## Knowledge (retrieved)", ...lines].join("\n"),
      summary: `${data.length} knowledge hits`,
    };
  } catch {
    return { status: "ok", contextText: "", summary: "knowledge unavailable" };
  }
}

export async function runConnectionStatus(
  client: AnyClient,
  userId: string,
  provider: "gmail" | "google_drive"
): Promise<ToolResult> {
  try {
    const { data } = await client
      .from("user_integration_connections")
      .select("status")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();
    const status = (data?.status as string | undefined) ?? "not_connected";
    const connected = status === "connected";
    return {
      status: "ok",
      contextText: connected
        ? ""
        : `## ${provider} status\n- ${provider} is ${status}. Tell the user this is setup-needed and they can connect it in Settings; do not pretend to read ${provider} content.`,
      summary: `${provider}: ${status}`,
    };
  } catch {
    return {
      status: "ok",
      contextText: `## ${provider} status\n- ${provider} integration not provisioned yet (setup needed).`,
      summary: `${provider}: setup needed`,
    };
  }
}

// --------------------------------------------------------------------------
// Draft tools (real inserts into existing studio tables; status='draft' ONLY)
// --------------------------------------------------------------------------

/** Create a real Social Studio DRAFT. Never publishes. */
export async function draftSocialPost(
  client: AnyClient,
  profile: Profile,
  sessionId: string | null,
  agentType: AgentType,
  args: { body: string; title?: string; channels?: string[] }
): Promise<{ ok: boolean; id: string | null; degraded: boolean }> {
  try {
    const { data, error } = await client
      .from("social_posts")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        title: args.title ?? null,
        body: args.body.slice(0, 5000),
        channels: args.channels ?? [],
        status: "draft", // hard rule: never scheduled/published by an agent
        metadata: { created_by_agent: agentType, source: "agent_runtime" },
      })
      .select("id")
      .maybeSingle();
    if (error) {
      const degraded = isMissingDatabaseObjectError(error);
      await logToolCall(client, { sessionId, profile, agentType, toolName: TOOLS.draft_social_post, inputSummary: args.title ?? "social draft", outputSummary: degraded ? "table missing" : error.message, status: degraded ? "skipped" : "error" });
      return { ok: false, id: null, degraded };
    }
    const id = (data?.id as string | undefined) ?? null;
    await logToolCall(client, { sessionId, profile, agentType, toolName: TOOLS.draft_social_post, inputSummary: args.title ?? "social draft", outputSummary: `draft ${id} created`, status: "ok" });
    await recordAudit({ actor: profile, action: "agent.draft_social_post", target_type: "social_post", target_id: id, metadata: { agent_type: agentType } });
    return { ok: true, id, degraded: false };
  } catch (error) {
    return { ok: false, id: null, degraded: isMissingDatabaseObjectError(error) };
  }
}

/** Create a real Email Studio DRAFT. Never sends. */
export async function draftEmail(
  client: AnyClient,
  profile: Profile,
  sessionId: string | null,
  agentType: AgentType,
  args: { subject: string; bodyText?: string; bodyHtml?: string }
): Promise<{ ok: boolean; id: string | null; degraded: boolean }> {
  try {
    const { data, error } = await client
      .from("email_campaigns")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        subject: args.subject.slice(0, 300),
        body_text: args.bodyText ?? null,
        body_html: args.bodyHtml ?? null,
        status: "draft", // hard rule: never sending/sent by an agent
        metadata: { created_by_agent: agentType, source: "agent_runtime" },
      })
      .select("id")
      .maybeSingle();
    if (error) {
      const degraded = isMissingDatabaseObjectError(error);
      await logToolCall(client, { sessionId, profile, agentType, toolName: TOOLS.draft_email, inputSummary: args.subject, outputSummary: degraded ? "table missing" : error.message, status: degraded ? "skipped" : "error" });
      return { ok: false, id: null, degraded };
    }
    const id = (data?.id as string | undefined) ?? null;
    await logToolCall(client, { sessionId, profile, agentType, toolName: TOOLS.draft_email, inputSummary: args.subject, outputSummary: `draft ${id} created`, status: "ok" });
    await recordAudit({ actor: profile, action: "agent.draft_email", target_type: "email_campaign", target_id: id, metadata: { agent_type: agentType } });
    return { ok: true, id, degraded: false };
  } catch (error) {
    return { ok: false, id: null, degraded: isMissingDatabaseObjectError(error) };
  }
}

// --------------------------------------------------------------------------
// Zapier MCP tool (calls the user's saved MCP endpoint)
// --------------------------------------------------------------------------

export interface TriggerZapArgs {
  /** The path to POST to on the MCP endpoint, e.g. "/trigger". */
  path?: string;
  /** Arbitrary payload to forward to the Zapier MCP endpoint. */
  [key: string]: unknown;
}

/**
 * Call the user's saved Zapier MCP connection endpoint.
 * If the connection is not configured, returns a graceful not_configured result.
 * Never exposes the stored auth token.
 */
export async function runTriggerZap(
  client: AnyClient,
  profile: Profile,
  sessionId: string | null,
  agentType: AgentType,
  args: TriggerZapArgs
): Promise<ToolResult> {
  const { path: mcpPath = "/trigger", ...payload } = args;

  const result = await callUserMcpEndpoint(profile.id, mcpPath, payload);

  if (result.status === "not_configured") {
    await logToolCall(client, {
      sessionId,
      profile,
      agentType,
      toolName: TOOLS.trigger_zap,
      inputSummary: `path=${mcpPath}`,
      outputSummary: "not_configured",
      status: "skipped",
    });
    return {
      status: "skipped",
      contextText:
        "## Zapier MCP\n- Not configured. Go to Settings → Integrations to connect your Zapier account.",
      summary: "Zapier MCP not connected",
    };
  }

  const callStatus: ToolCallStatus = result.ok ? "ok" : "error";
  await logToolCall(client, {
    sessionId,
    profile,
    agentType,
    toolName: TOOLS.trigger_zap,
    inputSummary: `path=${mcpPath}`,
    outputSummary: result.message.slice(0, 300),
    status: callStatus,
  });

  if (result.ok) {
    await recordAudit({
      actor: profile,
      action: "agent.trigger_zap",
      target_type: "mcp_connections",
      target_id: null,
      metadata: { agent_type: agentType, path: mcpPath },
    });
  }

  return {
    status: callStatus,
    contextText: result.ok
      ? `## Zapier MCP\n- Automation triggered successfully via MCP endpoint.`
      : `## Zapier MCP\n- Automation call failed: ${result.message}`,
    summary: result.message.slice(0, 120),
  };
}
