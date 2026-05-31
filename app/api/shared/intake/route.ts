import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import { getAIProviderStatuses } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  SHARED_REVIEW_RESOURCE_TYPE,
  type SharedReviewRecommendation,
} from "@/lib/teamResources";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputKinds = [
  "plain_text",
  "markdown",
  "transcript",
  "pasted",
  "youtube_transcript",
  "uploaded_file",
] as const;

// Accept pasted/typed TEXT fully. For binary uploads (PDF/DOCX) the client
// sends only file metadata — we accept the file as "pending text extraction"
// and never pretend we parsed it. `source_text` may be empty for an
// uploaded_file, but for every text kind it is required.
const schema = z
  .object({
    title: z.string().trim().max(160).optional(),
    input_kind: z.enum(inputKinds),
    source_text: z.string().max(60000).optional().default(""),
    file: z
      .object({
        name: z.string().min(1).max(255),
        type: z.string().max(255).optional().default(""),
        size: z.number().int().nonnegative().optional().default(0),
      })
      .nullish(),
  })
  .refine(
    (d) => d.input_kind === "uploaded_file" || d.source_text.trim().length > 0,
    { message: "Paste or type content for text-based inputs.", path: ["source_text"] }
  )
  .refine((d) => d.input_kind !== "uploaded_file" || !!d.file, {
    message: "Upload a file or choose a text-based input.",
    path: ["file"],
  });

// True when at least one text provider is configured AND enabled by the owner.
function hasTextProvider(): boolean {
  return getAIProviderStatuses().some(
    (p) =>
      (p.id === "openrouter" ||
        p.id === "deepseek" ||
        p.id === "nvidia" ||
        p.id === "minimax") &&
      p.configured &&
      p.enabled
  );
}

const SHARE_STATUSES = ["team", "internal_only", "needs_owner_review"] as const;

// Extract the first balanced JSON object from a model response. Models often
// wrap JSON in prose or ```json fences, so we slice from the first "{" to the
// last "}" and parse that.
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRecommendation(
  obj: Record<string, unknown>
): SharedReviewRecommendation {
  const shareRaw = str(obj.share_status ?? obj.shareStatus);
  const shareStatus = SHARE_STATUSES.find((s) => s === shareRaw);
  return {
    title: str(obj.title),
    description: str(obj.description),
    category: str(obj.category),
    audience: str(obj.audience),
    body: str(obj.body),
    teamSummary: str(obj.team_summary ?? obj.teamSummary),
    sanitizedVersion: str(obj.sanitized_version ?? obj.sanitizedVersion),
    legendsVoiceRewrite: str(obj.legends_voice_rewrite ?? obj.legendsVoiceRewrite),
    complianceNotes: str(obj.compliance_notes ?? obj.complianceNotes),
    shareStatus,
  };
}

function buildPrompt(
  inputKind: string,
  sourceText: string,
  fileName: string | null
): string {
  const contentBlock =
    sourceText.trim().length > 0
      ? `Raw content (${inputKind}):\n"""\n${sourceText.slice(0, 24000)}\n"""`
      : `No extracted text is available yet. The user uploaded a file named "${
          fileName ?? "uploaded file"
        }" whose text has NOT been extracted. Base your recommendations on the filename and input type only, and explicitly note in compliance_notes that the file body was not reviewed.`;

  return [
    "You are the Shared Resource reviewer for the Legends Mortgage Team powered by Loan Factory.",
    "A team member submitted source material to be turned into a shareable internal resource.",
    "Analyze it and return ONLY a single JSON object (no prose, no markdown fences) with these keys:",
    '  "title": a short, clear resource title (max ~80 chars)',
    '  "description": a one or two sentence summary of what this resource is',
    '  "category": a short category label (e.g. "Buyer Education", "Sales Coaching", "Marketing")',
    '  "audience": who this is for (e.g. "Loan officers", "Realtor partners", "All team members")',
    '  "body": a clean, well-structured version of the content suitable for the team',
    '  "team_summary": a 2-3 sentence summary a team member could skim',
    '  "sanitized_version": the content with any borrower PII, account numbers, phone numbers, emails, or addresses removed or redacted',
    '  "legends_voice_rewrite": the content rewritten in a confident, helpful, compliant Legends Mortgage Team voice',
    '  "compliance_notes": plain-language compliance considerations (avoid rate/approval guarantees, keep fair-housing-safe, flag anything needing licensed review)',
    `  "share_status": one of ${SHARE_STATUSES.map((s) => `"${s}"`).join(", ")} — your recommendation for how widely to share`,
    "Do not invent borrower data. Do not promise rates or approvals. Keep it educational and compliant.",
    "",
    contentBlock,
  ].join("\n");
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  // Shared resources are owner-curated. Match the page's owner-only write gate.
  if (!isOwner(profile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Only the owner can create shared resource review items.",
      },
      { status: 403 }
    );
  }
  if (!profile.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: "Owner must belong to an organization.",
      },
      { status: 400 }
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
  const data = parsed.data;
  const supabase = getSupabaseServerClient();

  const fileMeta =
    data.input_kind === "uploaded_file" && data.file
      ? {
          name: data.file.name,
          type: data.file.type || "application/octet-stream",
          size: data.file.size ?? 0,
          // Honest: we accept the binary but do NOT parse it.
          pending_text_extraction: true,
        }
      : null;

  // --- AI review step ------------------------------------------------------
  // If no text provider is configured/enabled, we DO NOT fake a result. We
  // persist the item as "pending_ai_review" with an honest note so the owner
  // can re-run review once a provider is wired up.
  let reviewStatus: "pending_ai_review" | "ai_reviewed" = "pending_ai_review";
  let recommendation: SharedReviewRecommendation | null = null;
  let aiProvider: string | null = null;
  let aiModel: string | null = null;
  let aiNote: string | null = null;

  const canRunAi = hasTextProvider();
  if (!canRunAi) {
    aiNote =
      "No AI text provider is configured/enabled, so this item is saved as pending AI review. Configure a provider in Settings, then re-run review.";
  } else {
    const prompt = buildPrompt(
      data.input_kind,
      data.source_text,
      data.file?.name ?? null
    );
    const result = await runChat({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1800,
    });
    if (result.ok) {
      const json = extractJson(result.content);
      if (json) {
        recommendation = normalizeRecommendation(json);
        // Only mark reviewed if the AI actually produced usable fields.
        if (Object.values(recommendation).some(Boolean)) {
          reviewStatus = "ai_reviewed";
          aiProvider = result.provider;
          aiModel = result.model;
        } else {
          recommendation = null;
          aiNote =
            "The AI provider responded but returned no usable recommendations. Saved as pending AI review — try again.";
        }
      } else {
        aiNote =
          "The AI provider responded but the output could not be parsed into recommendations. Saved as pending AI review — try again.";
      }
    } else {
      // Honest failure note; never a fake "completed" status.
      aiNote = `AI review did not complete (${result.error}): ${result.message}. Saved as pending AI review — try again.`;
    }
  }

  const fallbackTitle =
    data.title?.trim() ||
    recommendation?.title ||
    data.file?.name ||
    data.source_text.trim().slice(0, 60) ||
    "Untitled review item";

  const payload: Record<string, unknown> = {
    review_status: reviewStatus,
    input_kind: data.input_kind,
    source_text: data.source_text,
    file: fileMeta,
    recommendation: recommendation
      ? {
          title: recommendation.title ?? null,
          description: recommendation.description ?? null,
          category: recommendation.category ?? null,
          audience: recommendation.audience ?? null,
          body: recommendation.body ?? null,
          team_summary: recommendation.teamSummary ?? null,
          sanitized_version: recommendation.sanitizedVersion ?? null,
          legends_voice_rewrite: recommendation.legendsVoiceRewrite ?? null,
          compliance_notes: recommendation.complianceNotes ?? null,
          share_status: recommendation.shareStatus ?? null,
        }
      : null,
    ai_provider: aiProvider,
    ai_model: aiModel,
    ai_note: aiNote,
  };

  // Persist into the EXISTING shared_resources table. is_active=false keeps
  // review items OUT of the team-facing active list until the owner publishes.
  const { data: inserted, error: insErr } = await supabase
    .from("shared_resources")
    .insert({
      organization_id: profile.organization_id,
      created_by: profile.id,
      title: fallbackTitle.slice(0, 160),
      description: recommendation?.description ?? null,
      resource_type: SHARED_REVIEW_RESOURCE_TYPE,
      payload,
      is_active: false,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: insErr?.message ?? "Failed to save review item.",
      },
      { status: 500 }
    );
  }

  await logUsage(profile, {
    module: "knowledge",
    event_type: "shared_review_item_created",
    provider: aiProvider,
    metadata: {
      item_id: inserted.id,
      review_status: reviewStatus,
      input_kind: data.input_kind,
      ai_ran: canRunAi,
    },
  });

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    review_status: reviewStatus,
    recommendation,
    ai_provider: aiProvider,
    ai_model: aiModel,
    ai_note: aiNote,
  });
}
