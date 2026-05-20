import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import type { AtlasCard } from "@/lib/atlas/cards";
import { buildKnowledgeContext } from "@/lib/atlas/context";
import { executeTool, type ExecResult } from "@/lib/atlas/executor";
import {
  detectAtlasIntent,
  type AtlasIntent,
} from "@/lib/atlas/intentDetection";
import { planAtlasTool } from "@/lib/atlas/planner";
import {
  buildCapabilitySnapshot,
  canRunAtlasTools,
  renderCapabilityMessage,
} from "@/lib/atlas/toolRouter";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { checkDailyCap, logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accept either undefined OR null for optional ids/strings — the chat client
// initializes thread_id and assistant_id to null on a fresh conversation.
const schema = z.object({
  thread_id: z.string().uuid().nullish(),
  assistant_id: z.string().uuid().nullish(),
  message: z.string().min(1).max(8000),
  provider: z.enum(["openrouter", "deepseek", "nvidia"]).nullish(),
  model: z.string().nullish(),
});

// Map the regex fast-path intent to a registry tool id + input. Keeps the
// fast path alive for the highest-traffic verbs ("draft a post about X")
// while routing every actual tool execution through the unified executor.
function intentToToolInvocation(
  intent: AtlasIntent
): { tool_id: string; input: Record<string, unknown> } | null {
  switch (intent.kind) {
    case "create_social":
      return {
        tool_id: "create_social_draft",
        input: {
          title: intent.extracted.title,
          body: intent.extracted.body,
          channels: intent.extracted.channels,
        },
      };
    case "create_email":
      return {
        tool_id: "create_email_draft",
        input: {
          subject: intent.extracted.subject,
          body: intent.extracted.body,
        },
      };
    case "create_calendar":
      return {
        tool_id: "create_calendar_item",
        input: {
          title: intent.extracted.title,
          starts_at: intent.extracted.starts_at,
          date_phrase: intent.extracted.date_phrase,
        },
      };
    case "create_knowledge_note":
      return {
        tool_id: "create_knowledge_note",
        input: {
          title: intent.extracted.title,
          body: intent.extracted.body,
          collection_hint: intent.extracted.collection_hint,
        },
      };
    case "explain_capabilities":
    case "capability_query":
      return {
        tool_id: "explain_capabilities",
        input: {},
      };
    default:
      return null;
  }
}

// Build the structured `tool_result` envelope persisted with every assistant
// message that ran a tool. AtlasShell switches on `kind` to pick a renderer.
function buildToolResultMeta(card: AtlasCard) {
  // Keep an `itemId` field on draft-creating cards so the existing
  // AtlasShell renderer (which reads `meta.tool_result.itemId`) keeps
  // working without a UI rebuild.
  const base: Record<string, unknown> = {
    kind: card.kind,
    tool_id: card.tool_id,
    title: card.title,
    summary: card.summary,
    link: card.link ?? null,
  };
  // Map new card kinds to the legacy `kind` strings AtlasShell already knows
  // how to render. New kinds (knowledge_results, asset_result, etc.) land as
  // a generic chip until the UI gets per-kind renderers.
  if (card.kind === "social_draft") {
    base.legacy_kind = "create_social";
    base.itemId = card.item_id;
  } else if (card.kind === "email_draft") {
    base.legacy_kind = "create_email";
    base.itemId = card.item_id;
  } else if (card.kind === "calendar_item") {
    base.legacy_kind = "create_calendar";
    base.itemId = card.item_id;
  } else if (card.kind === "knowledge_note") {
    base.legacy_kind = "create_knowledge_note";
    base.itemId = card.item_id;
  } else if (card.kind === "capability_snapshot") {
    base.legacy_kind = "explain_capabilities";
    base.itemId = "capabilities";
    base.capabilities = card.snapshot;
  }
  base.card = card;
  return base;
}

async function persistAssistantMessageAndRespond(args: {
  supabase: ReturnType<typeof getSupabaseServerClient>;
  thread_id: string;
  user_id: string;
  content: string;
  cap_used: number;
  cap_total: number;
  tool_result_meta?: Record<string, unknown> | null;
  kind?: string;
  source?: string;
}) {
  const metadata: Record<string, unknown> = {};
  if (args.tool_result_meta) metadata.tool_result = args.tool_result_meta;
  if (args.source) metadata.source = args.source;
  const { data: msg } = await args.supabase
    .from("chat_messages")
    .insert({
      thread_id: args.thread_id,
      user_id: args.user_id,
      role: "assistant",
      content: args.content,
      metadata,
    })
    .select("id")
    .single();
  await args.supabase
    .from("chat_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", args.thread_id);
  return NextResponse.json({
    ok: true,
    thread_id: args.thread_id,
    message_id: msg?.id ?? null,
    kind: args.kind ?? "tool_call",
    content: args.content,
    assistant_message: args.content,
    tool_result: args.tool_result_meta ?? null,
    provider: "atlas_tool",
    model: null,
    usage: { daily_count: args.cap_used + 1, daily_limit: args.cap_total },
    knowledge: { count: 0, sources: [] },
  });
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
  const { thread_id, assistant_id, message, provider, model } = parsed.data;

  // Owner can disable a provider org-wide via Settings without touching
  // env vars. Check the toggle first so a disabled provider never even
  // reaches the gateway.
  if (provider) {
    const sb = getSupabaseServerClient();
    const { data: row } = await sb
      .from("provider_credentials_public")
      .select("provider,is_enabled")
      .eq("provider", provider)
      .maybeSingle();
    if (row && row.is_enabled === false) {
      return NextResponse.json(
        {
          ok: false,
          error: "provider_disabled",
          message: `${provider} is disabled by the owner. Re-enable it in Settings → AI Provider Gateway.`,
          provider,
        },
        { status: 200 }
      );
    }
  }

  // Daily cap.
  const cap = await checkDailyCap(profile, "atlas", "chat");
  if (!cap.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "cap_exceeded",
        message: `Daily Atlas message cap reached (${cap.used}/${cap.cap}). Ask Jeremy to lift the cap.`,
      },
      { status: 429 }
    );
  }

  const supabase = getSupabaseServerClient();

  // Create or reuse the thread.
  let threadId: string = thread_id ?? "";
  if (!threadId) {
    const { data: thread, error: tErr } = await supabase
      .from("chat_threads")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        assistant_id: assistant_id ?? null,
        title: message.slice(0, 60),
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (tErr || !thread) {
      return NextResponse.json(
        { ok: false, error: "internal_error", message: tErr?.message ?? "thread create failed" },
        { status: 500 }
      );
    }
    threadId = thread.id;
  }

  // Persist user message.
  const { error: userMsgErr } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    user_id: profile.id,
    role: "user",
    content: message,
  });
  if (userMsgErr) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: userMsgErr.message },
      { status: 500 }
    );
  }

  // ---- Atlas runtime layer ------------------------------------------------
  // Step 1: regex fast path. The detector catches verbatim "draft a post
  // about X" / "schedule X on tomorrow" / "what can you do?" intents and
  // short-circuits straight to a registered tool id. The actual handler runs
  // through `executeTool` so audit + role gating + readiness + Zod
  // validation are uniform regardless of how the tool was selected.
  // Step 2 (if no match): hand the message to the LLM planner with the tool
  // manifest. Planner returns a tool id + input or null. We never block on
  // planner failure — it falls through to normal chat.
  // Step 3 (if planner returns null): assemble history + knowledge block and
  // call the chat provider directly (normal chat fall-through).
  const intent = detectAtlasIntent(message);
  let invocation = canRunAtlasTools(profile)
    ? intentToToolInvocation(intent)
    : null;
  // Viewer falls through to chat. Capability query is read-only, so even
  // viewers should be able to ask it.
  if (!invocation && intent.kind === "capability_query") {
    invocation = intentToToolInvocation(intent);
  }

  // Planner fallback — only consult the LLM planner when the regex didn't
  // match AND the user can run write tools (or asked a read-only question
  // worth routing — we let the planner decide).
  if (!invocation && intent.kind === "none") {
    const { data: priorHistory } = await supabase
      .from("chat_messages")
      .select("role,content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(12);
    const trimmedHistory = (priorHistory ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
      .map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
    const knowledgeCtx = await buildKnowledgeContext({
      assistant_id: assistant_id ?? null,
      message,
      limit: 4,
    });
    const planned = await planAtlasTool({
      profile,
      message,
      history: trimmedHistory,
      knowledge_block: knowledgeCtx.block,
      provider: provider ?? undefined,
      model: model ?? undefined,
    });
    if (planned.tool_id && !planned.needs_chat_fallback) {
      invocation = {
        tool_id: planned.tool_id,
        input: planned.input ?? {},
      };
    }
  }

  if (invocation) {
    const execResult: ExecResult = await executeTool({
      tool_id: invocation.tool_id,
      input: invocation.input,
      profile,
      thread_id: threadId,
      assistant_id: assistant_id ?? null,
    });
    if (execResult.ok) {
      const card = execResult.result.card;
      // For the capability snapshot we still render the legacy rich text
      // body — that's the canonical UX. Everything else uses the handler's
      // returned `message` (which is the plain-English honest-action line).
      const content =
        card.kind === "capability_snapshot"
          ? renderCapabilityMessage(buildCapabilitySnapshot())
          : execResult.result.message;
      return persistAssistantMessageAndRespond({
        supabase,
        thread_id: threadId,
        user_id: profile.id,
        content,
        cap_used: cap.used,
        cap_total: cap.cap,
        tool_result_meta: buildToolResultMeta(card),
        kind: card.kind === "capability_snapshot" ? "capability_query" : "tool_call",
        source: card.kind === "capability_snapshot" ? "atlas_capability_query" : undefined,
      });
    }
    // Failure path — log the raw error, surface a plain-English message.
    console.error("atlas_tool_failed", execResult);
    await logUsage(profile, {
      module: "atlas",
      event_type: "atlas_tool_call_failed",
      metadata: {
        thread_id: threadId,
        tool_id: execResult.tool_id,
        error: execResult.error,
      },
    });
    return persistAssistantMessageAndRespond({
      supabase,
      thread_id: threadId,
      user_id: profile.id,
      content: execResult.message,
      cap_used: cap.used,
      cap_total: cap.cap,
      tool_result_meta: null,
      kind: "tool_call_failed",
      source: "atlas_tool_failure",
    });
  }

  // ---- Chat fall-through --------------------------------------------------
  // Fetch prior turns for context.
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role,content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(24);

  // Knowledge retrieval — pull up to 5 relevant items from the collections
  // wired to this assistant. Falls back to no-op when no assistant_id or no
  // mappings; never fatal.
  const knowledgeCtx = await buildKnowledgeContext({
    assistant_id: assistant_id ?? null,
    message,
    limit: 5,
  });
  const knowledgeHits = knowledgeCtx.hits;
  const knowledgeBlock = knowledgeCtx.block;

  // Assemble the message list. If we have a knowledge block, append it as a
  // trailing system message so the provider's `messages` array includes it
  // without overwriting the assistant's own system prompt.
  const baseMessages = (history ?? [])
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));
  const messages = knowledgeBlock
    ? [
        ...baseMessages,
        {
          role: "system" as const,
          content: `(Knowledge attached by the LegendsOS retrieval layer):${knowledgeBlock}`,
        },
      ]
    : baseMessages;

  const result = await runChat({
    provider: provider ?? undefined,
    model: model ?? undefined,
    messages,
  });

  // Always log a usage event so the cap is enforced even on failure.
  await logUsage(profile, {
    module: "atlas",
    event_type: result.ok ? "chat_message" : "chat_message_blocked",
    provider: provider ?? "openrouter",
    metadata: {
      thread_id: threadId,
      ok: result.ok,
      error: result.ok ? null : result.error,
    },
  });

  if (!result.ok) {
    // Persist a system note so the thread shows why it failed.
    await supabase.from("chat_messages").insert({
      thread_id: threadId,
      user_id: profile.id,
      role: "system",
      content: `[${result.error}] ${result.message}`,
      metadata: { source: "gateway", error: result.error },
    });
    return NextResponse.json(result, { status: 200 });
  }

  // Persist assistant response. We persist BOTH the count and the source
  // list (title + source_path + collection_id) into metadata so the AtlasShell
  // citation chips survive a page refresh. Without persisting the source list,
  // a reload would restore the count but lose the per-source titles, leaving
  // a generic "N sources" pill with no clickable chips.
  const knowledgeSources = knowledgeHits.map((h) => ({
    title: h.title,
    source_path: h.source_path,
    collection_id: h.collection_id,
    item_id: h.item_id,
  }));
  const { data: assistantMsg } = await supabase
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      user_id: profile.id,
      role: "assistant",
      content: result.content,
      token_count: result.usage?.total_tokens ?? null,
      metadata: {
        provider: result.provider,
        model: result.model,
        knowledge_hits: knowledgeHits.length,
        knowledge_sources: knowledgeSources,
      },
    })
    .select("id")
    .single();

  await supabase
    .from("chat_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  // Persist retrieval_references so the message → item link can be replayed
  // later (and surfaced in the UI as citations once we build that out).
  if (knowledgeHits.length > 0 && assistantMsg?.id) {
    try {
      const service = getSupabaseServiceClient();
      await service.from("retrieval_references").insert(
        knowledgeHits.map((h) => ({
          message_id: assistantMsg.id,
          item_id: h.item_id,
          score: h.score,
          excerpt: h.excerpt,
          metadata: { source_path: h.source_path },
        }))
      );
    } catch (e) {
      console.error("retrieval_references insert failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    thread_id: threadId,
    message_id: assistantMsg?.id ?? null,
    content: result.content,
    provider: result.provider,
    model: result.model,
    usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
    knowledge: {
      count: knowledgeHits.length,
      // Mirror the persisted shape so client and server stay in sync — chips
      // get the collection_id they need to render a clickable deep-link.
      sources: knowledgeSources,
    },
  });
}
