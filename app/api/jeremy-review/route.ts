import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  content: z.string().min(1).max(20000),
  // "asset" (default) = the user pasted the GENERATED draft to be reviewed as a
  // final, about-to-publish asset. "brief" = the user is running a pre-check on
  // the instruction brief/prompt itself (not the final asset). The mode only
  // changes how the content is framed to the reviewer; it never fabricates a
  // verdict.
  mode: z.enum(["asset", "brief"]).optional().default("asset"),
});

type DimensionStatus = "pass" | "needs_edit" | "escalate";

type Dimension = {
  status: DimensionStatus;
  note: string;
};

type ReviewResult = {
  verdict: DimensionStatus;
  dimensions: {
    brand: Dimension;
    clarity: Dimension;
    compliance: Dimension;
    cta: Dimension;
    mortgageClaims: Dimension;
    missingInfo: Dimension;
  };
  summary: string;
};

const SYSTEM_PROMPT = [
  "You are Jeremy's AI brand and compliance reviewer for The Legends Mortgage Team.",
  "You review the FINAL, generated marketing or website asset BEFORE it is published, the way Jeremy McDonald would.",
  "IMPORTANT: You are judging the actual produced copy/asset itself — NOT a set of instructions, a brief, or a prompt. If the supplied text reads like instructions to an AI (e.g. it lists rules such as 'Do NOT promise a rate' or 'Always include NMLS'), it is NOT a finished asset: do not treat the mere presence of compliance instructions as compliance. Judge what an end reader would actually see.",
  "Evaluate the supplied content across exactly six dimensions:",
  "  - brand: Brand fit. Does it match a warm, professional, local, trustworthy mortgage-team voice?",
  "  - clarity: Is it clear, skimmable, and easy for an everyday homebuyer to understand?",
  "  - compliance: Compliance risk. Mortgage advertising compliance. Flag any rate guarantees, approval guarantees, promised closing times, or 'lowest/best rate' claims. Confirm the actual NMLS ID and the Equal Housing / Equal Housing Opportunity statement are PRESENT in the finished copy (a real ID, not a [placeholder]).",
  "  - cta: Is there a clear, single, compelling call to action?",
  "  - mortgageClaims: Mortgage claims check. Any risky or misleading mortgage language — individualized financial/legal/tax advice, absolute promises, guaranteed savings, or anything that could mislead a borrower.",
  "  - missingInfo: Missing info. Identify required elements that are absent or still left as unfilled placeholders (e.g. NMLS ID, Equal Housing statement, loan officer name/title, disclosures). If something a published asset legally needs is missing or still a [placeholder], flag it.",
  "For each dimension assign a status of 'pass', 'needs_edit', or 'escalate' and a one-sentence note explaining why.",
  "Then assign an overall verdict: 'pass' (publish-ready), 'needs_edit' (fixable issues), or 'escalate' (serious compliance/risk — Jeremy must review personally).",
  "The overall verdict must be at least as severe as the most severe dimension (any 'escalate' dimension forces an 'escalate' verdict; any 'needs_edit' forces at least 'needs_edit').",
  "Respond with ONLY a strict JSON object, no markdown, no code fences, in exactly this shape:",
  '{"verdict":"pass|needs_edit|escalate","dimensions":{"brand":{"status":"pass|needs_edit|escalate","note":"..."},"clarity":{"status":"...","note":"..."},"compliance":{"status":"...","note":"..."},"cta":{"status":"...","note":"..."},"mortgageClaims":{"status":"...","note":"..."},"missingInfo":{"status":"...","note":"..."}},"summary":"one or two sentences"}',
].join("\n");

// When the user explicitly pre-checks the BRIEF (the instruction prompt) rather
// than the produced asset, we tell the reviewer so it judges the brief on its
// own terms and never confuses "the brief lists the rules" with "the asset
// follows the rules". The verdict still reflects real issues; nothing is faked.
const BRIEF_PRECHECK_NOTE =
  "NOTE: The user is pre-checking their BRIEF (the instruction prompt that will be sent to an AI builder), NOT the final asset. Judge whether the brief is well-formed and asks for the right compliance elements. Do NOT treat this as a publish-ready sign-off — it is only a pre-check of the brief. In your summary, make clear this reviews the brief, not the final asset.";

const VALID_STATUSES: DimensionStatus[] = ["pass", "needs_edit", "escalate"];

function coerceStatus(value: unknown): DimensionStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (VALID_STATUSES as string[]).includes(normalized)
    ? (normalized as DimensionStatus)
    : null;
}

function coerceDimension(value: unknown): Dimension | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const status = coerceStatus(record.status);
  if (!status) return null;
  const note =
    typeof record.note === "string" && record.note.trim().length > 0
      ? record.note.trim()
      : "No note provided.";
  return { status, note };
}

// Pull the first balanced JSON object out of the model's text. Models
// sometimes wrap the JSON in prose or ```json fences despite instructions,
// so we slice from the first "{" to the last "}" before parsing.
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseReview(text: string): ReviewResult | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const dims = record.dimensions;
  if (!dims || typeof dims !== "object") return null;
  const d = dims as Record<string, unknown>;

  const brand = coerceDimension(d.brand);
  const clarity = coerceDimension(d.clarity);
  const compliance = coerceDimension(d.compliance);
  const cta = coerceDimension(d.cta);
  // Accept a couple of reasonable key aliases the model might emit so a sound
  // review isn't thrown away over naming. Falls back to null → honest
  // "unparseable" state, never a fabricated pass.
  const mortgageClaims = coerceDimension(
    d.mortgageClaims ?? d.mortgage_claims ?? d.risk,
  );
  const missingInfo = coerceDimension(d.missingInfo ?? d.missing_info);
  if (
    !brand ||
    !clarity ||
    !compliance ||
    !cta ||
    !mortgageClaims ||
    !missingInfo
  ) {
    return null;
  }

  const dimensions = {
    brand,
    clarity,
    compliance,
    cta,
    mortgageClaims,
    missingInfo,
  };

  // Derive the verdict from the dimensions so it can never be softer than the
  // worst dimension, even if the model reports an inconsistent overall verdict.
  const severity: Record<DimensionStatus, number> = {
    pass: 0,
    needs_edit: 1,
    escalate: 2,
  };
  const worst = Object.values(dimensions).reduce<DimensionStatus>(
    (acc, dim) => (severity[dim.status] > severity[acc] ? dim.status : acc),
    "pass",
  );
  const reported = coerceStatus(record.verdict) ?? worst;
  const verdict =
    severity[reported] >= severity[worst] ? reported : worst;

  const summary =
    typeof record.summary === "string" && record.summary.trim().length > 0
      ? record.summary.trim()
      : "Review complete.";

  return { verdict, dimensions, summary };
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 },
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
      { status: 400 },
    );
  }

  const { content, mode } = parsed.data;
  const userInstruction =
    mode === "brief"
      ? `${BRIEF_PRECHECK_NOTE}\n\nPre-check the following BRIEF and return the strict JSON review object only.\n\n---\n${content}\n---`
      : `Review the following FINAL generated asset (the actual copy a reader will see) and return the strict JSON review object only.\n\n---\n${content}\n---`;

  const result = await runChat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInstruction },
    ],
    temperature: 0.2,
    max_tokens: 900,
  });

  // No provider configured / enabled — degrade honestly. The UI shows a
  // "needs a provider" state instead of a fake verdict.
  if (!result.ok) {
    if (
      result.error === "provider_not_configured" ||
      result.error === "provider_disabled"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "ai_unavailable",
          message:
            "AI review needs a provider — see Settings, AI Provider Gateway.",
        },
        { status: 200 },
      );
    }
    // Transient provider/internal failure (timeout, 5xx, etc.).
    return NextResponse.json(
      {
        ok: false,
        error: "review_failed",
        message:
          "Jeremy's AI reviewer couldn't complete the review just now. Try again in a moment.",
      },
      { status: 200 },
    );
  }

  const review = parseReview(result.content);
  if (!review) {
    // Provider answered but not in a shape we can trust. Do NOT fabricate a
    // verdict — surface an honest "couldn't parse" state.
    return NextResponse.json(
      {
        ok: false,
        error: "unparseable",
        message:
          "Jeremy's AI reviewer returned a response we couldn't read as a verdict. Try running the review again.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    model: result.model,
    review,
  });
}
