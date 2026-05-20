// Build a structured handoff card for the chat surface.
//
// Pure formatting — no DB write, no audit. The card is the canonical surface;
// the assistant message body restates it as plain text so people pasting the
// chat into Slack / docs still get the same content.

import type { HandoffSummaryCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CreateHandoffSummaryInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "create_handoff_summary";

export async function createHandoffSummary(
  input: CreateHandoffSummaryInput,
  _ctx: AtlasToolContext
): Promise<AtlasToolResult<HandoffSummaryCard>> {
  const card: HandoffSummaryCard = {
    kind: "handoff_summary",
    tool_id: TOOL_ID,
    title: `Handoff: ${input.topic.slice(0, 80)}`,
    summary: input.next_step.slice(0, 120),
    bullets: input.bullets,
    next_step: input.next_step,
  };
  // Warm intro so the chat bubble explains what just happened before
  // restating the structured handoff card as paste-friendly text. Pasting
  // chat into Slack / docs keeps the same bullets + next step.
  const message = [
    `Here's the handoff summary you asked for on "${input.topic}".`,
    "",
    ...input.bullets.map((b) => `• ${b}`),
    "",
    `Next step: ${input.next_step}`,
  ].join("\n");
  return { ok: true, card, message };
}
