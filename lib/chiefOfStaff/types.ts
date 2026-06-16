// AI Chief of Staff — shared types (v1).
//
// The Chief of Staff answers one question for Jeremy when he opens LegendsOS:
// "What matters today?" It is a thin, read-only intelligence layer over data
// the platform already stores. No new heavy schema, no LOS behavior, no CRM
// build — just prioritized, explainable recommendations.

// Confidence is intentionally a 3-level human scale, not a float. v1 rules are
// simple heuristics; we never imply more precision than we have.
export type Confidence = "Low" | "Medium" | "High";

// The five fixed surfaces of the daily briefing.
export type SectionKey =
  | "people_to_contact"
  | "loans_needing_attention"
  | "agent_relationships_cooling"
  | "opportunities"
  | "broken_automations";

// A single recommendation card. Every field maps directly to something the UI
// renders — there is no hidden state.
export interface Recommendation {
  // Stable-enough id for React keys; derived from the source row id.
  id: string;
  // Short, human title — the "who/what".
  title: string;
  // One sentence: why this surfaced and why it matters today.
  whyItMatters: string;
  // The single next action Jeremy (or the team) should take.
  suggestedAction: string;
  // The exact signal used, in plain language (e.g. "No update in 12 days").
  // This is the honesty contract — every card shows what triggered it.
  sourceSignal: string;
  confidence: Confidence;
  // Optional deep-link to the relevant existing page. Omitted when there is no
  // good destination — we never invent routes.
  href?: string;
  hrefLabel?: string;
  // Internal sort weight (higher = more urgent). Not rendered.
  weight: number;
}

// One section of the briefing. `source` distinguishes real data from an empty
// read so the UI can show an honest empty state instead of a fake claim.
export interface BriefingSection {
  key: SectionKey;
  title: string;
  // Short description of what this section watches.
  blurb: string;
  source: "db" | "empty" | "unavailable";
  // Useful message when there is nothing to show (or the table is missing).
  emptyMessage: string;
  recommendations: Recommendation[];
}

// The whole "what matters today" payload.
export interface ChiefOfStaffBriefing {
  generatedAt: string;
  // Total actionable items across all sections.
  totalCount: number;
  // High-confidence count — the "do these first" number.
  highPriorityCount: number;
  sections: BriefingSection[];
}
