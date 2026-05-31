// LegendsOS v2 — Gmail AI Intake classifier.
// -------------------------------------------------------------------------
// Two-stage, cost-aware:
//   1. classifyByRules()  — free heuristic on sender domain + subject/snippet.
//      Returns a category + confidence. High confidence ends here.
//   2. classifyHard()     — only for low-confidence cases, calls DeepSeek via
//      the existing gateway. If NO AI provider is configured/usable, we DO NOT
//      guess — the item stays `unknown_needs_review` (classified_by "none").
//
// Nothing here sends, deletes, or files anything. It only labels.

import { runChat } from "@/lib/ai/providers";
import type { IntakeCategory, ClassifiedBy } from "./types";
import { INTAKE_CATEGORIES } from "./types";

export interface ClassifyInput {
  fromAddress?: string | null;
  fromName?: string | null;
  subject?: string | null;
  snippet?: string | null;
  hasAttachments?: boolean;
}

export interface ClassifyResult {
  category: IntakeCategory;
  confidence: number; // 0..1
  classifiedBy: ClassifiedBy;
  /** True when the rule stage was unsure and a hard pass is warranted. */
  needsHardPass: boolean;
}

function hay(input: ClassifyInput): string {
  return `${input.subject ?? ""} \n ${input.snippet ?? ""}`.toLowerCase();
}
function domainOf(addr?: string | null): string {
  const at = (addr ?? "").split("@")[1] ?? "";
  return at.toLowerCase().trim();
}
function anyOf(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// Cheap rule classifier. Conservative: when unsure, low confidence so the
// hard pass (or Needs Review) takes over.
export function classifyByRules(input: ClassifyInput): ClassifyResult {
  const text = hay(input);
  const domain = domainOf(input.fromAddress);
  const mk = (category: IntakeCategory, confidence: number): ClassifyResult => ({
    category,
    confidence,
    classifiedBy: "rule",
    needsHardPass: confidence < 0.6,
  });

  // Phishing / spam signals first (safety).
  if (
    anyOf(text, ["verify your account", "unusual sign-in", "wire instructions changed", "gift card", "password expires", "click here to confirm your bank"]) ||
    anyOf(text, ["account suspended", "confirm your identity immediately"])
  ) {
    return mk("phishing_risk", 0.7);
  }
  if (anyOf(text, ["unsubscribe", "% off", "limited time offer", "newsletter", "webinar invite"])) {
    return mk("promotional", 0.65);
  }

  // Lender / title / insurance / realtor by sender domain or keywords.
  if (anyOf(text, ["title commitment", "title policy", "escrow", "settlement statement", "cd is ready", "closing disclosure"]) || anyOf(domain, ["title", "escrow"])) {
    return mk("title_update", 0.66);
  }
  if (anyOf(text, ["homeowners insurance", "hazard insurance", "insurance binder", "declaration page", "policy number"]) || domain.includes("insur")) {
    return mk("insurance_update", 0.66);
  }
  if (anyOf(text, ["condition", "conditions", "underwriting", "uw approval", "suspended for", "prior to docs", "ptd", "ptf"])) {
    return mk("underwriting_condition", 0.62);
  }
  if (anyOf(text, ["rate lock", "lock confirmation", "loan estimate", "disclosure package", "investor", "lender update"])) {
    return mk("lender_update", 0.6);
  }
  if (anyOf(text, ["showing", "listing", "purchase agreement", "realtor", "buyer's agent", "seller's agent", "mls"])) {
    return mk("realtor_update", 0.6);
  }

  // Customer-facing.
  if (input.hasAttachments && anyOf(text, ["attached", "see attached", "paystub", "pay stub", "w-2", "w2", "bank statement", "id", "drivers license", "tax return", "requested documents", "here are my"])) {
    return mk("customer_document_returned", 0.6);
  }
  if (anyOf(text, ["question", "how do i", "can you", "what is", "when will", "status of my loan", "i don't understand"])) {
    return mk("customer_question", 0.55);
  }
  if (anyOf(text, ["pre-approval", "preapproval", "looking to buy", "get qualified", "interested in a loan", "new application", "zillow", "lead"])) {
    return mk("new_lead", 0.55);
  }

  // Internal team chatter.
  if (anyOf(text, ["processor", "handoff", "internal", "fyi team", "loan #"])) {
    return mk("processor_internal", 0.5);
  }

  // Default: not confident — send to the hard pass / Needs Review.
  return { category: "unknown_needs_review", confidence: 0.2, classifiedBy: "none", needsHardPass: true };
}

const SYSTEM_PROMPT = `You are an email triage classifier for a US mortgage team (The Legends Mortgage Team). Classify the email into EXACTLY ONE of these category ids:
${INTAKE_CATEGORIES.join(", ")}.
Rules: be conservative; if genuinely unclear use "unknown_needs_review". Never invent loan or borrower facts. Respond with ONLY strict JSON: {"category":"<id>","confidence":<0..1>}`;

function parseCategory(raw: string): { category: IntakeCategory; confidence: number } | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(raw.slice(start, end + 1)) as { category?: string; confidence?: number };
    const cat = (obj.category ?? "").trim() as IntakeCategory;
    if (!INTAKE_CATEGORIES.includes(cat)) return null;
    const conf = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.5;
    return { category: cat, confidence: conf };
  } catch {
    return null;
  }
}

// Hard pass — DeepSeek only (cost-aware). If AI is unavailable, returns a
// Needs Review result with classifiedBy "none" (we never guess).
export async function classifyHard(input: ClassifyInput): Promise<ClassifyResult> {
  const userContent = [
    `From: ${input.fromName ?? ""} <${input.fromAddress ?? ""}>`,
    `Subject: ${input.subject ?? ""}`,
    `Has attachments: ${input.hasAttachments ? "yes" : "no"}`,
    `Snippet: ${input.snippet ?? ""}`,
  ].join("\n");

  const result = await runChat({
    provider: "deepseek",
    temperature: 0,
    max_tokens: 60,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  if (!result.ok) {
    // No usable AI provider (or a hard error) — do not guess.
    return {
      category: "unknown_needs_review",
      confidence: 0,
      classifiedBy: "none",
      needsHardPass: false,
    };
  }
  const parsed = parseCategory(result.content);
  if (!parsed) {
    return {
      category: "unknown_needs_review",
      confidence: 0,
      classifiedBy: "none",
      needsHardPass: false,
    };
  }
  return { ...parsed, classifiedBy: "ai", needsHardPass: false };
}

// Full pipeline: cheap rules, escalate hard cases to DeepSeek, else Needs Review.
export async function classifyEmail(input: ClassifyInput): Promise<ClassifyResult> {
  const ruled = classifyByRules(input);
  if (!ruled.needsHardPass) return ruled;
  return classifyHard(input);
}
