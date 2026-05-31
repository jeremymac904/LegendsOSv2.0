/**
 * POST /api/vibe/review — "Jeremy AI Review" of a composed Vibe Coding prompt.
 *
 * This is an AI STYLE review (Jeremy's reviewer persona), NOT a human review.
 * Body: { content: string, kind: VibeKind }
 *
 * Behaviour:
 *   - Auth-guarded the same way the other app API routes are (getCurrentProfile).
 *   - Daily cap shared with Atlas chat so this can't be abused to bypass caps.
 *   - Calls the configured text provider via the same server-side gateway
 *     (runChat in lib/ai/providers.ts) used by /api/ai/chat. No new AI system.
 *   - Returns a STRUCTURED verdict: brand fit, clarity, compliance risk, CTA,
 *     mortgage claims, missing info, and a final verdict.
 *   - If NO provider is configured/enabled, returns { status: 'ai_not_configured' }
 *     so the UI can show an honest "configure a provider" state. NEVER fabricates
 *     a review.
 *
 * SAFETY: read-only. No drafts saved, nothing published or sent.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import { getAIProviderStatuses } from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";
import { checkDailyCap, logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIBE_KINDS = [
  "realtor_landing",
  "blog_post",
  "simple_website",
  "content_page",
  "marketing_idea",
] as const;

const schema = z.object({
  content: z.string().min(1).max(8000),
  kind: z.enum(VIBE_KINDS),
});

const KIND_LABELS: Record<(typeof VIBE_KINDS)[number], string> = {
  realtor_landing: "Realtor landing page",
  blog_post: "Blog post",
  simple_website: "Simple website",
  content_page: "Content page",
  marketing_idea: "Marketing idea",
};

// The structured verdict the UI renders. Each section is a short, plain-English
// note. `final_verdict` is one of three honest states so the UI can color it.
export interface VibeReview {
  brand_fit: string;
  clarity: string;
  compliance_risk: string;
  cta: string;
  mortgage_claims: string;
  missing_info: string;
  final_verdict: "ship_it" | "tweak_first" | "rework";
  summary: string;
}

const VERDICTS = ["ship_it", "tweak_first", "rework"] as const;

function reviewerSystemPrompt(): string {
  return [
    "You are 'Jeremy's AI Reviewer' — an AI style reviewer modeled on Jeremy McDonald, a mortgage loan officer on The Legends Mortgage Team powered by Loan Factory.",
    "You review marketing/content prompts and copy for loan officers before they are used.",
    "You are direct, practical, and protective of the brand and of mortgage advertising compliance.",
    "You are an AI assistant, NOT a human compliance officer or attorney — never claim to give legal approval. Flag risk; recommend human review where needed.",
    "Evaluate the submission and return ONLY a single JSON object (no markdown, no prose outside the JSON) with exactly these string fields:",
    "  brand_fit, clarity, compliance_risk, cta, mortgage_claims, missing_info, summary,",
    "  and final_verdict which MUST be one of: 'ship_it', 'tweak_first', 'rework'.",
    "Each field except final_verdict is 1-2 short sentences.",
    "compliance_risk: call out anything that could violate mortgage advertising rules (guaranteed rates/approvals, 'no risk', misleading APR/payment claims, missing NMLS / equal-housing context, unsupported superlatives).",
    "mortgage_claims: specifically check rate, payment, approval, and qualification claims for accuracy and required disclaimers.",
    "cta: assess whether the call-to-action is clear and appropriate.",
    "missing_info: note any key information the prompt/copy still needs.",
    "Be honest. If it's strong, say so. If it has real problems, say 'rework'.",
  ].join("\n");
}

function buildUserMessage(kind: (typeof VIBE_KINDS)[number], content: string): string {
  return [
    `Submission type: ${KIND_LABELS[kind]}`,
    "",
    "Prompt / copy to review:",
    '"""',
    content,
    '"""',
    "",
    "Return the JSON verdict now.",
  ].join("\n");
}

// Pull the first JSON object out of a model response. Providers sometimes wrap
// JSON in ```json fences or add a stray sentence; we tolerate that here. We
// never fabricate fields — missing fields fall back to an honest placeholder.
function parseReview(raw: string): VibeReview | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;
  const verdictRaw = typeof obj.final_verdict === "string" ? obj.final_verdict.trim() : "";
  const final_verdict = (VERDICTS as readonly string[]).includes(verdictRaw)
    ? (verdictRaw as VibeReview["final_verdict"])
    : "tweak_first";
  return {
    brand_fit: str(obj.brand_fit, "Not assessed."),
    clarity: str(obj.clarity, "Not assessed."),
    compliance_risk: str(obj.compliance_risk, "Not assessed — have a human review compliance."),
    cta: str(obj.cta, "Not assessed."),
    mortgage_claims: str(obj.mortgage_claims, "Not assessed — verify any rate/payment/approval claims."),
    missing_info: str(obj.missing_info, "Not assessed."),
    final_verdict,
    summary: str(obj.summary, "Review complete."),
  };
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }
  const { content, kind } = parsed.data;

  // Honest "not configured" path — if no text provider is configured AND enabled,
  // we never invent a review. The UI renders a configure-a-provider state.
  const anyProviderReady = getAIProviderStatuses().some(
    (p) =>
      (p.id === "openrouter" ||
        p.id === "deepseek" ||
        p.id === "nvidia" ||
        p.id === "minimax") &&
      p.configured &&
      p.enabled
  );
  if (!anyProviderReady) {
    return NextResponse.json(
      {
        ok: true,
        status: "ai_not_configured",
        message:
          "No AI provider is configured. Ask the owner to add a text provider in Settings to run Jeremy AI Review.",
      },
      { status: 200 }
    );
  }

  // Share the Atlas chat daily cap so the reviewer can't be used to bypass it.
  const cap = await checkDailyCap(profile, "atlas", "chat");
  if (!cap.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "cap_exceeded",
        message: `Daily AI cap reached (${cap.used}/${cap.cap}). Ask Jeremy to lift the cap.`,
      },
      { status: 429 }
    );
  }

  const result = await runChat({
    messages: [
      { role: "system", content: reviewerSystemPrompt() },
      { role: "user", content: buildUserMessage(kind, content) },
    ],
    temperature: 0.3,
    max_tokens: 900,
  });

  await logUsage(profile, {
    module: "atlas",
    event_type: result.ok ? "vibe_review" : "vibe_review_blocked",
    provider: result.ok ? result.provider : null,
    metadata: { kind, ok: result.ok, error: result.ok ? null : result.error },
  });

  if (!result.ok) {
    // Provider configured but the call failed (timeout, 5xx, etc.). Surface an
    // honest error — do NOT fabricate a verdict.
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        message: result.message,
      },
      { status: 200 }
    );
  }

  const review = parseReview(result.content);
  if (!review) {
    return NextResponse.json(
      {
        ok: false,
        error: "unparseable_review",
        message:
          "The reviewer returned a response that couldn't be parsed into a verdict. Try again.",
        raw: result.content.slice(0, 600),
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: "reviewed",
    review,
    provider: result.provider,
    model: result.model,
    usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
  });
}
