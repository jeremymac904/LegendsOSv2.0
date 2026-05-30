import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  content: z.string().min(1).max(20000),
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
    compliance: Dimension;
    clarity: Dimension;
    cta: Dimension;
    risk: Dimension;
  };
  summary: string;
};

const SYSTEM_PROMPT = [
  "You are Jeremy's AI brand and compliance reviewer for The Legends Mortgage Team.",
  "You review marketing and website copy BEFORE it is published, the way Jeremy McDonald would.",
  "Evaluate the supplied content across exactly five dimensions:",
  "  - brand: Does it match a warm, professional, local, trustworthy mortgage-team voice?",
  "  - compliance: Mortgage advertising compliance. Flag any rate guarantees, approval guarantees, promised closing times, or 'lowest/best rate' claims. Check for NMLS ID presence and Equal Housing / Equal Housing Opportunity awareness.",
  "  - clarity: Is it clear, skimmable, and easy for an everyday homebuyer to understand?",
  "  - cta: Is there a clear, single, compelling call to action?",
  "  - risk: Any risky mortgage language — individualized financial/legal/tax advice, absolute promises, or anything that could mislead a borrower.",
  "For each dimension assign a status of 'pass', 'needs_edit', or 'escalate' and a one-sentence note explaining why.",
  "Then assign an overall verdict: 'pass' (publish-ready), 'needs_edit' (fixable issues), or 'escalate' (serious compliance/risk — Jeremy must review personally).",
  "The overall verdict must be at least as severe as the most severe dimension (any 'escalate' dimension forces an 'escalate' verdict; any 'needs_edit' forces at least 'needs_edit').",
  "Respond with ONLY a strict JSON object, no markdown, no code fences, in exactly this shape:",
  '{"verdict":"pass|needs_edit|escalate","dimensions":{"brand":{"status":"pass|needs_edit|escalate","note":"..."},"compliance":{"status":"...","note":"..."},"clarity":{"status":"...","note":"..."},"cta":{"status":"...","note":"..."},"risk":{"status":"...","note":"..."}},"summary":"one or two sentences"}',
].join("\n");

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
  const compliance = coerceDimension(d.compliance);
  const clarity = coerceDimension(d.clarity);
  const cta = coerceDimension(d.cta);
  const risk = coerceDimension(d.risk);
  if (!brand || !compliance || !clarity || !cta || !risk) return null;

  const dimensions = { brand, compliance, clarity, cta, risk };

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

  const result = await runChat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review the following content and return the strict JSON review object only.\n\n---\n${parsed.data.content}\n---`,
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
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
