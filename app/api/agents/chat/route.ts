import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { runAgentChat } from "@/lib/agents/runtime";
import { AGENT_TYPES } from "@/lib/agents/types";
import { checkDailyCap, logUsage } from "@/lib/usage";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  agent_type: z.enum(AGENT_TYPES),
  message: z.string().min(1).max(8000),
  session_id: z.string().uuid().nullish(),
  loan_id: z.string().uuid().nullish(),
  provider: z.string().max(40).nullish(),
  model: z.string().max(120).nullish(),
  origin: z.enum(["web", "browser_companion", "handoff", "api"]).nullish(),
  browser_context: z
    .object({
      source_url: z.string().max(2000).nullish(),
      source_title: z.string().max(500).nullish(),
      selected_text: z.string().max(8000).nullish(),
      structured: z.record(z.unknown()).nullish(),
    })
    .nullish(),
});

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated", message: "Sign in first." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  // Per-day cap (shared with Atlas). Best-effort — never block on cap errors.
  try {
    const cap = await checkDailyCap(profile, "atlas", "chat");
    if (!cap.allowed) {
      return NextResponse.json(
        { ok: false, error: "daily_cap_reached", message: `Daily message cap reached (${cap.used}/${cap.cap}).` },
        { status: 429 }
      );
    }
  } catch {
    // cap table not available — proceed
  }

  const client = getSupabaseServerClient();
  const b = parsed.data;
  const result = await runAgentChat(client, profile, {
    agentType: b.agent_type,
    message: b.message,
    sessionId: b.session_id ?? null,
    loanId: b.loan_id ?? null,
    provider: b.provider ?? null,
    model: b.model ?? null,
    origin: b.origin ?? "web",
    browserContext: b.browser_context
      ? {
          sourceUrl: b.browser_context.source_url ?? null,
          sourceTitle: b.browser_context.source_title ?? null,
          selectedText: b.browser_context.selected_text ?? null,
          structured: b.browser_context.structured ?? null,
        }
      : null,
  });

  if (!result.ok) {
    // Honest setup-needed vs hard error. 200 for setup-needed so the UI can
    // render a calm "connect a provider" banner instead of an error toast.
    const status = result.setupNeeded ? 200 : result.error === "forbidden" ? 403 : result.error === "bad_request" ? 400 : 502;
    return NextResponse.json(result, { status });
  }

  try {
    await logUsage(profile, {
      module: "atlas",
      event_type: "agent_chat",
      provider: result.provider,
      metadata: { agent_type: b.agent_type, degraded: result.degraded },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json(result);
}
