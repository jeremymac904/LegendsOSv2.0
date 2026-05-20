// Atlas persona selection.
//
// The persona contributes a few extra lines to the planner's system prompt so
// the planner respects who Atlas is talking to and how Atlas should phrase
// its replies. We default to the Jeremy persona (owner of Legends Mortgage)
// and pick alternates only when the profile indicates a different role.
//
// This file is intentionally pure — no DB calls, no network, no env reads.
// The planner calls `personaFor(profile)` and stitches the result into the
// system prompt before sending to the provider.

import type { Profile } from "@/types/database";

export interface AtlasPersona {
  id: string;
  label: string;
  // Two or three short lines appended to the planner's system prompt.
  prompt_lines: string[];
}

const OWNER: AtlasPersona = {
  id: "jeremy_owner",
  label: "Jeremy (owner)",
  prompt_lines: [
    "You're talking to Jeremy McDonald, the owner of The Legends Mortgage Team powered by Loan Factory.",
    "Jeremy operates the whole LegendsOS stack — speak concisely, prefer drafts over questions, and never claim to have published or sent anything externally.",
    "If you can route a request to an Atlas tool, do it instead of describing the steps.",
  ],
};

const LOAN_OFFICER: AtlasPersona = {
  id: "loan_officer",
  label: "Loan officer",
  prompt_lines: [
    "You're talking to a licensed loan officer on the Legends Mortgage Team.",
    "Stay focused on marketing copy, client education, and operational drafts. Never claim to publish or send anything.",
    "Default to drafts in Social Studio / Email Studio / Calendar; the LO reviews before any live action.",
  ],
};

const MARKETING: AtlasPersona = {
  id: "marketing",
  label: "Marketing teammate",
  prompt_lines: [
    "You're talking to a marketing teammate on the Legends Mortgage Team.",
    "Lean into copy quality and brand voice. All output is a draft — never claim to publish.",
  ],
};

const PROCESSOR: AtlasPersona = {
  id: "processor",
  label: "Processor",
  prompt_lines: [
    "You're talking to a loan processor. Keep replies operational and concise.",
    "Calendar and knowledge tools are the most useful here. Drafts only.",
  ],
};

const VIEWER: AtlasPersona = {
  id: "viewer",
  label: "Viewer",
  prompt_lines: [
    "You're talking to a viewer-role user — they can read but cannot create drafts.",
    "Answer informational questions and explain capabilities; do not call tools that write.",
  ],
};

export function personaFor(profile: Profile | null): AtlasPersona {
  if (!profile) return VIEWER;
  if (profile.role === "owner" || profile.role === "admin") return OWNER;
  if (profile.role === "loan_officer") return LOAN_OFFICER;
  if (profile.role === "marketing") return MARKETING;
  if (profile.role === "processor") return PROCESSOR;
  return VIEWER;
}

export function personaSystemPromptAddendum(persona: AtlasPersona): string {
  return persona.prompt_lines.map((l) => `- ${l}`).join("\n");
}
