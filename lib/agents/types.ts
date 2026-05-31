// LegendsOS v2 — Agent Runtime types
// ---------------------------------------------------------------------------
// The shared contract every role-based agent and every API route imports.
// Mirrors the DB shape in supabase/migrations/20260601100000_agent_runtime.sql.
// No secrets, OAuth tokens, passwords or raw borrower PII ever flow through
// these types into trace/tool/metadata fields — only summaries.
// ---------------------------------------------------------------------------

import type { UserRole } from "@/types/database";

export const AGENT_TYPES = [
  "owner_atlas",
  "lo_atlas",
  "processor_flo",
  "coordinator_agent",
  "builder_agent",
  "marketing_agent",
  "academy_agent",
  "media_agent",
  "social_agent",
  "docs_agent",
  "ux_agent",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export function isAgentType(value: string): value is AgentType {
  return (AGENT_TYPES as readonly string[]).includes(value);
}

export const MEMORY_CATEGORIES = [
  "profile_preference",
  "tone_preference",
  "workflow_preference",
  "borrower_workflow",
  "document_workflow",
  "email_workflow",
  "social_workflow",
  "loan_condition_workflow",
  "drive_folder_workflow",
  "prompt_pattern",
  "saved_instruction",
  "personal_rule",
  "assistant_note",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type Confidence = "high" | "medium" | "low";
export type Priority = "highest" | "high" | "medium" | "low" | "lowest";
export type AgentMessageRole = "user" | "assistant" | "system" | "tool";
export type SessionStatus = "active" | "archived" | "handed_off";
export type ToolCallStatus =
  | "ok"
  | "blocked"
  | "error"
  | "needs_confirmation"
  | "skipped";
export type HandoffStatus = "pending" | "accepted" | "declined" | "completed";

// ---------------------------------------------------------------------------
// Agent definitions (registry)
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  type: AgentType;
  /** Display name shown in the chat header. */
  name: string;
  /** Short role line shown under the name. */
  role: string;
  /** One-sentence description for pickers / admin. */
  description: string;
  /** Roles that may act as this agent (owner/admin always may). */
  allowedRoles: UserRole[];
  /** Tool names (see lib/agents/tools.ts) this agent is permitted to call. */
  tools: string[];
  /** Whether loan-memory retrieval should run for loan-related messages. */
  loanAware: boolean;
  /** Builds the agent's system persona prompt (lives in lib/agents/prompts.ts). */
  buildSystemPrompt: (ctx: AgentPersonaContext) => string;
}

export interface AgentPersonaContext {
  userName: string | null;
  brandLine: string;
}

// ---------------------------------------------------------------------------
// Persisted row shapes
// ---------------------------------------------------------------------------

export interface AgentSession {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_type: AgentType;
  title: string | null;
  status: SessionStatus;
  loan_id: string | null;
  loan_memory_id: string | null;
  origin: "web" | "browser_companion" | "handoff" | "api";
  context_summary: string | null;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  user_id: string | null;
  agent_type: AgentType;
  role: AgentMessageRole;
  content: string;
  provider: string | null;
  model: string | null;
  trace_id: string | null;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentMemory {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_type: AgentType;
  category: MemoryCategory;
  title: string;
  body: string;
  tags: string[];
  confidence: Confidence;
  priority: Priority;
  source_summary: string | null;
  is_active: boolean;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentSkill {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_type: AgentType;
  skill_name: string;
  skill_slug: string;
  description: string | null;
  trigger_phrases: string[];
  input_schema: Record<string, unknown>;
  output_format: string | null;
  steps: string[];
  source_examples: string[];
  confidence: Confidence;
  usage_count: number;
  last_used_at: string | null;
  created_by: string | null;
  visibility: "owner_only" | "assigned_user" | "team_shared";
  is_active: boolean;
  is_shared_with_team: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentTrace {
  id: string;
  session_id: string | null;
  message_id: string | null;
  user_id: string;
  agent_type: AgentType;
  input_summary: string | null;
  context_loaded: string[];
  skills_used: string[];
  tools_called: string[];
  provider: string | null;
  model_used: string | null;
  output_type: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentHandoff {
  id: string;
  from_session_id: string | null;
  to_session_id: string | null;
  from_user_id: string;
  to_user_id: string | null;
  from_agent_type: AgentType;
  to_agent_type: AgentType;
  reason: string | null;
  context_summary: string | null;
  status: HandoffStatus;
  metadata: Record<string, unknown>;
  accepted_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Runtime context bundle (loaded before every response)
// ---------------------------------------------------------------------------

export interface ContextSource {
  /** Stable label shown in the trace + UI context panel, e.g. "user_memory". */
  label: string;
  /** Human count/summary, e.g. "3 preferences". */
  detail: string;
}

export interface AgentContextBundle {
  /** Markdown system block assembled from all loaded sources. */
  systemBlock: string;
  /** Labels of everything that was loaded (for trace + UI). */
  sources: ContextSource[];
  /** Skill names that were surfaced as relevant to this turn. */
  skillsLoaded: string[];
  /** True when persistence tables aren't applied yet (setup-needed mode). */
  degraded: boolean;
}

// ---------------------------------------------------------------------------
// Chat runtime I/O
// ---------------------------------------------------------------------------

export interface AgentChatInput {
  agentType: AgentType;
  message: string;
  sessionId?: string | null;
  /** Optional structured context from the Browser Companion extension. */
  browserContext?: BrowserAgentContext | null;
  /** Optional explicit loan link. */
  loanId?: string | null;
  provider?: string | null;
  model?: string | null;
  origin?: AgentSession["origin"];
}

export interface BrowserAgentContext {
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  selectedText?: string | null;
  structured?: Record<string, unknown> | null;
}

export interface SkillSuggestion {
  /** True when the user's message contained an explicit "save this" trigger. */
  explicit: boolean;
  matchedPhrase: string | null;
  proposedName: string;
  proposedSlug: string;
}

export type AgentChatResult =
  | {
      ok: true;
      sessionId: string | null;
      messageId: string | null;
      traceId: string | null;
      content: string;
      provider: string;
      model: string;
      contextSources: ContextSource[];
      skillsUsed: string[];
      toolsCalled: string[];
      degraded: boolean;
      skillSuggestion: SkillSuggestion | null;
    }
  | {
      ok: false;
      /** Honest machine code, e.g. "provider_not_configured", "unauthorized". */
      error: string;
      message: string;
      /** True when the only thing missing is configuration (setup-needed). */
      setupNeeded?: boolean;
      envVar?: string | null;
    };
