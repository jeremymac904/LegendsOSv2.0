// LegendsOS v2 — AI voice / tone profiles + loan response format rules.
// Drives user_ai_preferences defaults and how loan answers are shaped.

export interface VoiceProfile {
  id: string;
  label: string;
  /** System-prompt fragment describing the voice. */
  rules: string;
  defaultSignature: string;
}

export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  jeremy: {
    id: "jeremy",
    label: "Jeremy — Operator",
    rules:
      "Plain English. Direct. Short but thorough. Lead with the answer, then what matters, then the clear next action. Broker-first, mortgage-operator style. No emojis. No corporate filler.",
    defaultSignature: "Jeremy McDonald\nThe Legends Mortgage Team",
  },
  scott: {
    id: "scott",
    label: "Scott Mason — Operator",
    rules:
      "Calm, reliable, process-driven. Friendly and practical. Give clear timelines and the next concrete step. No emojis, no fluff.",
    defaultSignature: "Scott Mason\nThe Legends Mortgage Team",
  },
  eric: {
    id: "eric",
    label: "Eric Ritchie — Straight Shooter",
    rules:
      "Direct, dependable, practical, honest. Clear comparisons. No fluff, no emojis. Say what you'd do and why.",
    defaultSignature: "Eric Ritchie\nThe Legends Mortgage Team",
  },
};

export const DEFAULT_VOICE_ID = "jeremy";

export function getVoice(id: string | null | undefined): VoiceProfile {
  return VOICE_PROFILES[id ?? DEFAULT_VOICE_ID] ?? VOICE_PROFILES[DEFAULT_VOICE_ID];
}

// Default loan-answer format (status / what matters / next action / missing).
export const LOAN_RESPONSE_FORMAT = `When answering a loan question, structure the answer as:
1. Current status
2. What matters
3. Next action
4. Missing or needs verification
Use "Unknown" or leave blank when a value is missing — do not guess. Never claim clear_to_close / closed / denied / suspended / dead without source evidence.`;

// Pipeline-update confirmation template (Agent 7).
export function pipelineUpdateConfirmation(args: {
  borrowerName: string;
  status: string;
  nextAction: string;
  missing: string;
}): string {
  return [
    `Updated the pipeline for ${args.borrowerName}.`,
    ``,
    `Current status:`,
    args.status || "Unknown",
    ``,
    `Next action:`,
    args.nextAction || "Unknown",
    ``,
    `Missing or needs verification:`,
    args.missing || "None",
  ].join("\n");
}

// Channel-specific shaping rules (email/text/processing notes).
export const CHANNEL_RULES = {
  email:
    "Return the subject line separately from the body. Short paragraphs, plain English, clear next steps. No emojis, no corporate filler. Use the writer's voice profile.",
  text:
    "Short, natural, direct. Don't over-explain. Don't start with the person's name if the thread is already active. No emojis.",
  processing:
    "Clean operational language. Prioritize what Ashley or Geraldine needs next. Separate: conditions, title, appraisal, HOI, income, assets, credit, closing items.",
} as const;
