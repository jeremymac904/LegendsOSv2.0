import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import {
  retrieveForAssistant,
  renderKnowledgeBlock,
} from "@/lib/atlas/retrieval";
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
  let threadId = thread_id ?? null;
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
  let knowledgeHits: Awaited<
    ReturnType<typeof retrieveForAssistant>
  > = [];
  let knowledgeBlock = "";
  try {
    if (assistant_id) {
      knowledgeHits = await retrieveForAssistant({
        assistant_id,
        message,
        limit: 5,
      });
      knowledgeBlock = renderKnowledgeBlock(knowledgeHits);
    }
  } catch (e) {
    console.error("knowledge retrieval failed", e);
  }

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
        // Re-inject the user's last message after the system block so the
        // provider answers the user, not the system. The user message is
        // already in baseMessages, but re-stating keeps it adjacent.
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

  // Persist assistant response.
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
      sources: knowledgeHits.map((h) => ({
        title: h.title,
        source_path: h.source_path,
      })),
    },
  });
}
