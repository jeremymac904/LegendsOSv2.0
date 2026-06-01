// LegendsOS v2 — Agent registry
// ---------------------------------------------------------------------------
// The source of truth for agent identity, who may act as each agent, which
// tools each may call, and whether loan-memory retrieval applies. The DB
// agent_type CHECK constraint must stay in sync with AGENT_TYPES.
// ---------------------------------------------------------------------------

import type { Profile, UserRole } from "@/types/database";

import { buildPersonaPrompt } from "./prompts";
import type { AgentDefinition, AgentType } from "./types";

// Tool name constants (implementations in lib/agents/tools.ts).
export const TOOLS = {
  loan_memory_lookup: "loan_memory_lookup",
  loan_memory_update: "loan_memory_update",
  browser_context_read: "browser_context_read",
  gmail_status_check: "gmail_status_check",
  drive_status_check: "drive_status_check",
  knowledge_search: "knowledge_search",
  resource_search: "resource_search",
  draft_email: "draft_email",
  draft_text: "draft_text",
  draft_social_post: "draft_social_post",
  create_processing_note: "create_processing_note",
  create_coordinator_followup: "create_coordinator_followup",
  create_builder_prompt: "create_builder_prompt",
  create_training_summary: "create_training_summary",
  create_youtube_repurpose_plan: "create_youtube_repurpose_plan",
  review_output: "review_output",
} as const;

const READ_TOOLS = [
  TOOLS.knowledge_search,
  TOOLS.resource_search,
  TOOLS.browser_context_read,
  TOOLS.gmail_status_check,
  TOOLS.drive_status_check,
];

function def(
  type: AgentType,
  name: string,
  role: string,
  description: string,
  allowedRoles: UserRole[],
  tools: string[],
  loanAware: boolean
): AgentDefinition {
  return {
    type,
    name,
    role,
    description,
    allowedRoles,
    tools,
    loanAware,
    buildSystemPrompt: (ctx) => buildPersonaPrompt(type, ctx),
  };
}

export const AGENT_REGISTRY: Record<AgentType, AgentDefinition> = {
  owner_atlas: def(
    "owner_atlas",
    "Atlas",
    "Owner command assistant",
    "Jeremy's operator brain — strategy, ops, pipeline, marketing direction, agent orchestration.",
    ["owner", "admin"],
    [...READ_TOOLS, TOOLS.loan_memory_lookup, TOOLS.draft_email, TOOLS.draft_social_post, TOOLS.create_builder_prompt, TOOLS.review_output],
    true
  ),
  lo_atlas: def(
    "lo_atlas",
    "Atlas",
    "Loan officer assistant",
    "A loan officer's personal assistant for borrower comms, marketing, and production.",
    ["owner", "admin", "loan_officer"],
    [...READ_TOOLS, TOOLS.loan_memory_lookup, TOOLS.draft_email, TOOLS.draft_text, TOOLS.draft_social_post],
    true
  ),
  processor_flo: def(
    "processor_flo",
    "FLO",
    "Processing assistant",
    "Ashley's processing brain — conditions, missing docs, title/insurance/appraisal, CTC planning.",
    ["owner", "admin", "processor"],
    [...READ_TOOLS, TOOLS.loan_memory_lookup, TOOLS.loan_memory_update, TOOLS.create_processing_note, TOOLS.draft_email],
    true
  ),
  coordinator_agent: def(
    "coordinator_agent",
    "Coordinator Assistant",
    "Loan coordination assistant",
    "The follow-up engine — document chasing, realtor updates, milestone tracking, handoffs.",
    ["owner", "admin", "coordinator"],
    [...READ_TOOLS, TOOLS.loan_memory_lookup, TOOLS.create_coordinator_followup, TOOLS.draft_email, TOOLS.draft_text],
    true
  ),
  builder_agent: def(
    "builder_agent",
    "Builder",
    "Build assistant",
    "Websites, landing pages, blog/training content, Claude Code/Codex/AionUI prompts, resource pages.",
    ["owner", "admin", "loan_officer"],
    [...READ_TOOLS, TOOLS.create_builder_prompt, TOOLS.create_training_summary, TOOLS.review_output],
    false
  ),
  marketing_agent: def(
    "marketing_agent",
    "Marketing Assistant",
    "Marketing content assistant",
    "Social, email, image prompts, YouTube repurposing, GBP/Meta posts, content calendars, compliance.",
    ["owner", "admin", "marketing", "loan_officer"],
    [...READ_TOOLS, TOOLS.draft_social_post, TOOLS.draft_email, TOOLS.create_youtube_repurpose_plan, TOOLS.review_output],
    false
  ),
  academy_agent: def(
    "academy_agent",
    "Academy Assistant",
    "Training assistant",
    "Training scripts, roleplay, lesson outlines, quick-reference guides.",
    ["owner", "admin", "loan_officer"],
    [...READ_TOOLS, TOOLS.create_training_summary],
    false
  ),
  media_agent: def(
    "media_agent",
    "Media Assistant",
    "Media planning assistant",
    "Video/audio/image planning, hooks, shot lists, captions, repurposing.",
    ["owner", "admin", "marketing", "loan_officer"],
    [...READ_TOOLS, TOOLS.create_youtube_repurpose_plan],
    false
  ),
  social_agent: def(
    "social_agent",
    "Social Assistant",
    "Social content assistant",
    "Platform-specific social drafts with compliance reminders.",
    ["owner", "admin", "marketing", "loan_officer"],
    [...READ_TOOLS, TOOLS.draft_social_post],
    false
  ),
  docs_agent: def(
    "docs_agent",
    "Docs Assistant",
    "Documentation assistant",
    "Internal docs, SOPs, checklists, user guides.",
    ["owner", "admin"],
    [...READ_TOOLS, TOOLS.create_training_summary],
    false
  ),
  ux_agent: def(
    "ux_agent",
    "UX Assistant",
    "Product/UX assistant",
    "Copy, flows, empty states, microcopy, UX review.",
    ["owner", "admin"],
    [...READ_TOOLS],
    false
  ),
};

export function getAgent(type: AgentType): AgentDefinition {
  return AGENT_REGISTRY[type];
}

/** Can this profile act as this agent? Owner/admin always may. */
export function canUseAgent(
  profile: Profile | null | undefined,
  type: AgentType
): boolean {
  if (!profile) return false;
  if (profile.role === "owner" || profile.role === "admin") return true;
  return AGENT_REGISTRY[type].allowedRoles.includes(profile.role);
}

/** The default agent for a given user role (used by Browser Companion routing). */
export function defaultAgentForRole(role: UserRole): AgentType {
  switch (role) {
    case "owner":
    case "admin":
      return "owner_atlas";
    case "processor":
      return "processor_flo";
    case "coordinator":
      return "coordinator_agent";
    case "marketing":
      return "marketing_agent";
    case "loan_officer":
    case "viewer":
    default:
      return "lo_atlas";
  }
}

/** All agents a profile may use, for pickers. */
export function agentsForProfile(profile: Profile | null | undefined): AgentType[] {
  if (!profile) return [];
  return (Object.keys(AGENT_REGISTRY) as AgentType[]).filter((t) =>
    canUseAgent(profile, t)
  );
}
