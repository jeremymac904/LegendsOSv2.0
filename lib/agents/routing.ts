// LegendsOS v2 — Browser Companion → agent routing
// ---------------------------------------------------------------------------
// "No more everything goes to Atlas only." An incoming capture is routed to the
// right agent based on the user's role and lightweight content hints:
//   LO          -> lo_atlas
//   processor   -> processor_flo (Ashley)
//   coordinator -> coordinator_agent (Geraldine)
//   marketing   -> marketing_agent
//   owner/admin -> owner_atlas, or builder_agent for build-y captures
// A marketing/social capture overrides to marketing_agent regardless of role.
// ---------------------------------------------------------------------------

import type { UserRole } from "@/types/database";

import { defaultAgentForRole } from "./registry";
import type { AgentType } from "./types";

const MARKETING_HINTS = /\b(post|caption|reel|instagram|facebook|youtube|gbp|google business|campaign|newsletter|social|hashtag)\b/i;
const BUILD_HINTS = /\b(landing page|website|build|deploy|prompt|component|repo|codex|claude code|aionui)\b/i;
const LOAN_PORTAL_HINTS = /\b(loan factory|condition|underwrit|appraisal|title|borrower|loan number|disclosure|ctc|clear to close)\b/i;

export function routeCaptureToAgent(
  role: UserRole,
  hintText: string | null | undefined
): AgentType {
  const text = (hintText ?? "").toLowerCase();

  // Content-driven overrides first (a marketing capture goes to marketing
  // even if the LO grabbed it).
  if (MARKETING_HINTS.test(text)) return "marketing_agent";

  // Role default.
  const base = defaultAgentForRole(role);

  // Owner/admin: route build-y captures to Builder, loan-portal captures to
  // FLO triage; otherwise the owner's Atlas.
  if (base === "owner_atlas") {
    if (BUILD_HINTS.test(text)) return "builder_agent";
    if (LOAN_PORTAL_HINTS.test(text)) return "processor_flo";
  }
  return base;
}

/** The page path an agent chat lives at (for deep-linking from a capture). */
export function agentPagePath(agentType: AgentType): string {
  switch (agentType) {
    case "processor_flo":
      return "/flo";
    case "coordinator_agent":
      return "/coordinator";
    case "builder_agent":
      return "/builder";
    case "marketing_agent":
    case "social_agent":
    case "media_agent":
      return "/marketing-assistant";
    case "owner_atlas":
    case "lo_atlas":
    default:
      return "/atlas";
  }
}
