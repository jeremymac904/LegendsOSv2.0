// LegendsOS v2 — Sprint 4 — Browser Companion: capture + route to Atlas.
//
// POST { source_url, source_title, selected_text, structured_context, task,
//        assistant } (auth required)
//   -> validate with zod
//   -> store a browser_companion_captures row via the user-scoped RLS client
//   -> write an integration_audit_log row (service role; ONLY non-content
//      metadata: source_url + timestamp + actor + routed assistant). We NEVER
//      console.log the borrower/PII content.
//   -> return { ok, capture_id, routing:{ href } } where href routes to
//      /atlas?prompt=<role-appropriate seeded prompt built from task+assistant+
//      context summary>.
//
// 42P01 (table not provisioned) -> { ok:false, error:'setup_needed' } honestly.
// Unauthenticated -> 401.
// OPTIONS -> CORS preflight (chrome-extension origin + credentials).

import { z } from "zod";

import {
  auditCapture,
  buildRoutingHref,
  corsJson,
  insertCapture,
  normalizeAssistant,
  preflight,
} from "@/lib/browserCompanion/store";
import { writeMemoryEvent } from "@/lib/loanMemory/events";
import { resolveLoanContext } from "@/lib/loanMemory/resolve";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

const captureSchema = z.object({
  source_url: z.string().url().max(2000).optional().or(z.literal("")),
  source_title: z.string().max(500).optional(),
  selected_text: z.string().max(20000).optional(),
  structured_context: z.record(z.unknown()).optional(),
  task: z.string().min(1).max(2000),
  assistant: z
    .enum(["owner", "loan_officer", "processor", "coordinator"])
    .optional(),
});

function isLoanFactoryContext(sourceUrl: string | null, sourceTitle: string | null): boolean {
  const value = `${sourceUrl ?? ""} ${sourceTitle ?? ""}`.toLowerCase();
  return value.includes("loanfactory") || value.includes("loan factory");
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return corsJson(req, { ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = captureSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson(
      req,
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      400
    );
  }

  const sourceUrl =
    parsed.data.source_url && parsed.data.source_url.length > 0
      ? parsed.data.source_url
      : null;
  const sourceTitle = parsed.data.source_title ?? null;
  const selectedText = parsed.data.selected_text ?? null;
  const structuredContext = parsed.data.structured_context ?? null;
  const assistant = normalizeAssistant(parsed.data.assistant);

  // Build the routing deep-link first so we can return it even if persistence
  // degrades — the user still gets routed to Atlas with the seeded prompt.
  const { href, seeded_prompt } = buildRoutingHref({
    assistant,
    task: parsed.data.task,
    source_url: sourceUrl,
    source_title: sourceTitle,
    selected_text: selectedText,
    structured_context: structuredContext,
  });

  // Persist via the user's RLS client so the row is scoped to them.
  const userClient = getSupabaseServerClient();
  const stored = await insertCapture(userClient, {
    user_id: profile.id,
    organization_id: profile.organization_id,
    source_url: sourceUrl,
    source_title: sourceTitle,
    selected_text: selectedText,
    structured_context: structuredContext,
    routed_assistant: assistant,
  });

  // Honest "setup needed" when the table is missing. We still return the
  // routing href so the extension's fallback (open /atlas) keeps working, but
  // we flag provisioned:false so the UI shows "setup needed" not "saved".
  if (!stored.provisioned) {
    return corsJson(
      req,
      {
        ok: false,
        error: "setup_needed",
        provisioned: false,
        capture_id: null,
        routing: { href, assistant },
      },
      200
    );
  }

  if (!stored.ok || !stored.data) {
    return corsJson(
      req,
      {
        ok: false,
        error: stored.error ?? "capture_failed",
        provisioned: true,
        capture_id: null,
        routing: { href, assistant },
      },
      200
    );
  }

  // Audit — non-content metadata only. Never blocks the capture; a missing
  // audit table is swallowed honestly.
  const audit = await auditCapture({
    actor_user_id: profile.id,
    organization_id: profile.organization_id,
    source_url: sourceUrl,
    routed_assistant: assistant,
    capture_id: stored.data.id,
  });

  let loanBrain:
    | {
        attempted: boolean;
        match_status?: string;
        loan_memory_id?: string | null;
        review_event_id?: string | null;
        event_written?: boolean;
      }
    | null = null;

  if (isLoanFactoryContext(sourceUrl, sourceTitle)) {
    loanBrain = { attempted: true };
    try {
      const resolved = await resolveLoanContext(userClient, {
        query_text: [
          sourceTitle,
          sourceUrl,
          selectedText,
          structuredContext ? JSON.stringify(structuredContext) : null,
        ]
          .filter(Boolean)
          .join("\n"),
        user_id: profile.id,
        browser_capture_id: stored.data.id,
        source_url: sourceUrl ?? undefined,
        source_title: sourceTitle ?? undefined,
        selected_text: selectedText ?? undefined,
        structured_context: structuredContext ?? undefined,
      });

      loanBrain.match_status = resolved.match_status;
      loanBrain.loan_memory_id = resolved.match?.loan_memory_id ?? null;

      if (resolved.match_status === "matched" && resolved.match) {
        const written = await writeMemoryEvent(userClient, {
          loan_memory_id: resolved.match.loan_memory_id,
          event_type: "ai_note",
          event_title: "Browser companion capture for review",
          event_summary: `Captured Loan Factory portal context for review from ${
            sourceTitle || sourceUrl || "browser companion"
          }.`,
          source_type: "browser_companion",
          source_name: sourceTitle || "Loan Factory portal",
          source_url_or_path: sourceUrl ?? undefined,
          source_timestamp: new Date().toISOString(),
          created_by: profile.id,
          confidence: "low",
        });
        loanBrain.event_written = written.ok;
        loanBrain.review_event_id = written.event_id ?? null;
      }
    } catch {
      loanBrain.match_status = "unavailable";
      loanBrain.event_written = false;
    }
  }

  return corsJson(req, {
    ok: true,
    provisioned: true,
    capture_id: stored.data.id,
    audit_recorded: audit.ok,
    loan_brain: loanBrain,
    routing: {
      href,
      assistant,
      // Echo the seeded prompt so the extension can also open it directly if it
      // prefers (e.g. via the #payload fallback on /browser-companion).
      seeded_prompt,
    },
  });
}
