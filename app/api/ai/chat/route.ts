import { NextResponse } from "next/server";
import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import { loadAgentMemory, renderMemoryBlock } from "@/lib/agents/memory";
import { defaultAgentForRole } from "@/lib/agents/registry";
import {
  loadAgentSkills,
  renderSkillsBlock,
  selectRelevantSkills,
} from "@/lib/agents/skills";
import { detectAtlasIntent } from "@/lib/atlas/intentDetection";
import {
  retrieveForAssistant,
  renderKnowledgeBlock,
} from "@/lib/atlas/retrieval";
import {
  attachKnowledgeHitsToRuntimeContext,
  loadAtlasRuntimeContext,
  publicRuntimeContext,
  renderAtlasRuntimeContextBlock,
  withLoanRuntimeContext,
  type AtlasRuntimeContext,
} from "@/lib/atlas/runtimeContext";
import {
  canRunAtlasTools,
  renderCapabilityMessage,
  runAtlasTool,
} from "@/lib/atlas/toolRouter";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { getAIProviderStatuses } from "@/lib/env";
import { isLoanRelated, isPipelineUpdate } from "@/lib/loanMemory/detect";
import { writeMemoryEvent } from "@/lib/loanMemory/events";
import {
  buildLoanSystemPrompt,
  runLoanRetrieval,
  type LoanRetrievalResult,
} from "@/lib/loanMemory/retrievalMiddleware";
import {
  DEFAULT_VOICE_ID,
  getVoice,
  pipelineUpdateConfirmation,
} from "@/lib/loanMemory/voices";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { checkDailyCap, logUsage } from "@/lib/usage";

// Human-readable label per tool — used in both the assistant text response
// for capability queries and in the friendly error text when a tool insert
// fails. Keep this list in sync with `AtlasToolKind` in lib/atlas/toolRouter.ts.
const TOOL_LABELS: Record<string, string> = {
  create_social: "Draft a social post (Facebook, Instagram, YouTube, Google Business)",
  create_email: "Draft a newsletter / email campaign",
  create_calendar: "Schedule a calendar item (team event, reminder)",
  create_knowledge_note: "Save a knowledge note to your collections",
};

// Plain-English re-mapping for the most common Atlas tool failure modes.
// We deliberately avoid leaking raw DB error text to the chat surface.
function friendlyToolFailure(kind: string, raw: string): string {
  const lower = (raw ?? "").toLowerCase();
  const subject =
    kind === "create_social"
      ? "social draft"
      : kind === "create_email"
      ? "newsletter draft"
      : kind === "create_calendar"
      ? "calendar item"
      : kind === "create_knowledge_note"
      ? "knowledge note"
      : "draft";
  if (lower.includes("row-level security") || lower.includes("policy")) {
    return `I tried to save your ${subject} but Supabase blocked it (row-level security). That usually means your account doesn't have write access — ask the owner to check your role.`;
  }
  if (lower.includes("violates foreign key") || lower.includes("foreign key")) {
    return `I tried to save your ${subject} but a required reference is missing. Try opening the matching studio (e.g. /knowledge, /social) and saving from there once.`;
  }
  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return `I tried to save your ${subject} but a duplicate already exists. Edit the existing one instead of creating a new draft.`;
  }
  if (lower.includes("null value") || lower.includes("not-null")) {
    return `I tried to save your ${subject} but a required field was empty. Give me a topic or title and try again.`;
  }
  // Fallback — keep it concise, do not leak the raw message.
  return `I tried to save your ${subject} but the database rejected it. Try rephrasing or open the studio directly to create it manually.`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accept either undefined OR null for optional ids/strings — the chat client
// initializes thread_id and assistant_id to null on a fresh conversation.
const schema = z.object({
  thread_id: z.string().uuid().nullish(),
  assistant_id: z.string().uuid().nullish(),
  message: z.string().min(1).max(8000),
  provider: z.enum(["openrouter", "deepseek", "nvidia", "minimax"]).nullish(),
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
  let effectiveAssistantId = assistant_id ?? null;
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
  } else if (!effectiveAssistantId) {
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("assistant_id")
      .eq("id", threadId)
      .maybeSingle();
    effectiveAssistantId = thread?.assistant_id ?? null;
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

  let loanRetrievalResult: LoanRetrievalResult | null = null;
  let runtimeContext: AtlasRuntimeContext | null = null;
  const loadRuntime = async () => {
    runtimeContext = await loadAtlasRuntimeContext({
      client: supabase,
      profile,
      assistantId: effectiveAssistantId,
      provider: provider ?? null,
      model: model ?? null,
      loanRetrieval: loanRetrievalResult,
    });
    return runtimeContext;
  };

  // ---- Loan Memory retrieval (additive, fully guarded) --------------------
  // BEFORE the model is called: if the message is loan-related, ATTEMPT
  // retrieval first. The assistant must never answer a loan question without
  // first grounding it in loan memory.
  //   • matched          → prepend the loan context to the system prompt below.
  //   • multiple_matches → short-circuit: ask the user to choose (never guess).
  //   • no_match         → short-circuit: ask for borrower / address / loan #.
  //   • pipeline update  → write a memory event and return the confirmation.
  // Everything is wrapped so a failure (or unapplied migration) can NEVER break
  // normal chat — non-loan messages skip this block entirely.
  let loanContextText: string | null = null;
  try {
    if (isLoanRelated(message)) {
      const retrieval = await runLoanRetrieval(supabase, {
        userId: profile.id,
        queryText: message,
        threadId: threadId ?? undefined,
      });
      loanRetrievalResult = retrieval;

      if (retrieval.loanRelated) {
        // Resolve the writer's voice for loan-shaped responses. Guarded: a
        // missing user_ai_preferences table (migration unapplied) falls back to
        // the default voice instead of throwing.
        let voicePref: string | null = null;
        try {
          const { data: pref } = await supabase
            .from("user_ai_preferences")
            .select("tone_profile")
            .eq("user_id", profile.id)
            .maybeSingle();
          voicePref = (pref as { tone_profile?: string } | null)?.tone_profile ?? null;
        } catch {
          voicePref = null;
        }
        const voice = getVoice(voicePref ?? DEFAULT_VOICE_ID);

        // (1) PIPELINE UPDATE on a matched loan → write event + confirm.
        if (
          retrieval.matchStatus === "matched" &&
          retrieval.memory &&
          isPipelineUpdate(message)
        ) {
          const write = await writeMemoryEvent(supabase, {
            loan_memory_id: retrieval.memory.id,
            event_type: "processor_note",
            event_title: "Pipeline update from Atlas chat",
            event_summary: message.slice(0, 2000),
            source_type: "atlas_chat",
            source_name: profile.full_name ?? profile.email ?? "Atlas user",
            created_by: profile.id,
            confidence: "medium",
            // No protected-status advances and no source_evidence flag — the
            // writer's guardrails reject CTC/closed/denied without evidence.
          });

          const confirm = pipelineUpdateConfirmation({
            borrowerName: retrieval.memory.borrower_name ?? "this loan",
            status: retrieval.memory.current_stage ?? "Unknown",
            nextAction: retrieval.memory.next_action ?? "Unknown",
            missing: (write.blocked_updates ?? []).join("; ") || "None",
          });

          const { data: puMsg } = await supabase
            .from("chat_messages")
            .insert({
              thread_id: threadId,
              user_id: profile.id,
              role: "assistant",
              content: confirm,
              metadata: {
                source: "loan_pipeline_update",
                loan_memory_id: retrieval.memory.id,
                event_id: write.event_id ?? null,
                applied_updates: write.applied_updates ?? [],
                blocked_updates: write.blocked_updates ?? [],
              },
            })
            .select("id")
            .single();
          await supabase
            .from("chat_threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);
          await logUsage(profile, {
            module: "atlas",
            event_type: "loan_pipeline_update",
            metadata: { thread_id: threadId, loan_memory_id: retrieval.memory.id },
          });
          const loadedRuntime = await loadRuntime();
          return NextResponse.json({
            ok: true,
            thread_id: threadId,
            message_id: puMsg?.id ?? null,
            kind: "loan_pipeline_update",
            content: confirm,
            assistant_message: confirm,
            provider: "loan_memory",
            model: null,
            loan: { match_status: "matched", panel: retrieval.panel ?? null },
            loan_context: {
              borrower_name: retrieval.memory.borrower_name,
              loan_number: retrieval.memory.loan_number,
              current_stage: retrieval.memory.current_stage,
              last_update: retrieval.memory.last_known_activity ?? retrieval.memory.updated_at ?? null,
              main_blocker: retrieval.memory.main_blocker,
              next_action: retrieval.memory.next_action,
              confidence: retrieval.memory.confidence,
              sources_checked: retrieval.sourcesChecked ?? retrieval.panel?.sources_checked ?? [],
              match_status: "matched",
              is_sample: retrieval.memory.is_sample,
            },
            runtime_context: publicRuntimeContext(loadedRuntime),
            usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
            knowledge: { count: 0, sources: [] },
          });
        }

        // (2) MATCHED question → carry context into the model call below.
        if (retrieval.matchStatus === "matched" && retrieval.contextText) {
          loanContextText = buildLoanSystemPrompt(retrieval.contextText, voice);
        }

        // (3) MULTIPLE / LOW CONFIDENCE → ask the user to choose. Never answer.
        else if (
          retrieval.matchStatus === "multiple_matches" ||
          retrieval.matchStatus === "low_confidence"
        ) {
          const candidates = retrieval.candidates ?? [];
          const lines = candidates
            .slice(0, 5)
            .map((c, i) => {
              const bits = [
                c.borrower_name ?? "Unknown borrower",
                c.loan_number ? `Loan #${c.loan_number}` : null,
                c.property_address ?? null,
              ]
                .filter(Boolean)
                .join(" — ");
              return `${i + 1}. ${bits}`;
            })
            .join("\n");
          const ask = candidates.length
            ? `I found more than one loan that could match. Which one do you mean?\n\n${lines}\n\nReply with the number, the borrower's full name, the property address, or the loan number.`
            : `I need to be sure which loan you mean before I answer. Give me the borrower's full name, the property address, or the loan number.`;
          const { data: askMsg } = await supabase
            .from("chat_messages")
            .insert({
              thread_id: threadId,
              user_id: profile.id,
              role: "assistant",
              content: ask,
              metadata: {
                source: "loan_retrieval_clarify",
                match_status: retrieval.matchStatus,
                candidates: candidates.map((c) => ({
                  loan_memory_id: c.loan_memory_id,
                  borrower_name: c.borrower_name,
                  loan_number: c.loan_number,
                  property_address: c.property_address,
                })),
              },
            })
            .select("id")
            .single();
          await supabase
            .from("chat_threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);
          await logUsage(profile, {
            module: "atlas",
            event_type: "loan_retrieval_clarify",
            metadata: { thread_id: threadId, match_status: retrieval.matchStatus },
          });
          const loadedRuntime = await loadRuntime();
          return NextResponse.json({
            ok: true,
            thread_id: threadId,
            message_id: askMsg?.id ?? null,
            kind: "loan_retrieval_clarify",
            content: ask,
            assistant_message: ask,
            provider: "loan_memory",
            model: null,
            loan: {
              match_status: retrieval.matchStatus,
              candidates: candidates.slice(0, 5),
            },
            runtime_context: publicRuntimeContext(loadedRuntime),
            usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
            knowledge: { count: 0, sources: [] },
          });
        }

        // (4) NO MATCH → ask for an identifier. Never answer the loan blind.
        else if (retrieval.matchStatus === "no_match") {
          const fieldLabel: Record<string, string> = {
            borrower_name: "the borrower's full name",
            property_address: "the property address",
            loan_number: "the loan number",
          };
          const wanted = (retrieval.requiredClarification ?? [
            "borrower_name",
            "property_address",
            "loan_number",
          ])
            .map((f) => fieldLabel[f] ?? f)
            .join(", or ");
          const ask = `I couldn't find a matching loan in memory yet, so I don't want to guess. Tell me ${wanted} and I'll pull it up.`;
          const { data: nmMsg } = await supabase
            .from("chat_messages")
            .insert({
              thread_id: threadId,
              user_id: profile.id,
              role: "assistant",
              content: ask,
              metadata: {
                source: "loan_retrieval_no_match",
                required_clarification: retrieval.requiredClarification ?? [],
              },
            })
            .select("id")
            .single();
          await supabase
            .from("chat_threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);
          await logUsage(profile, {
            module: "atlas",
            event_type: "loan_retrieval_no_match",
            metadata: { thread_id: threadId },
          });
          const loadedRuntime = await loadRuntime();
          return NextResponse.json({
            ok: true,
            thread_id: threadId,
            message_id: nmMsg?.id ?? null,
            kind: "loan_retrieval_no_match",
            content: ask,
            assistant_message: ask,
            provider: "loan_memory",
            model: null,
            loan: {
              match_status: "no_match",
              required_clarification: retrieval.requiredClarification ?? [],
            },
            runtime_context: publicRuntimeContext(loadedRuntime),
            usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
            knowledge: { count: 0, sources: [] },
          });
        }
      }
    }
  } catch (e) {
    // Loan retrieval is strictly additive. Any failure falls through to the
    // normal chat path so non-loan and loan chat both keep working.
    console.error("loan retrieval failed", e);
    loanContextText = null;
    loanRetrievalResult = null;
  }

  runtimeContext = await loadRuntime();

  // ---- Atlas tool router --------------------------------------------------
  // Before paying the provider, check whether the message is a deterministic
  // "do a thing" command (draft a post, write a newsletter, schedule an
  // event, save a knowledge note) OR a capability query. Side-effects are
  // DRAFT-ONLY — Atlas never posts, sends, or publishes externally. Tool
  // failures fall through to normal chat with a friendly message so the user
  // never sees a dead end.
  const intent = detectAtlasIntent(message);

  // Capability query handler — pure read, no DB write, returns the live
  // tool inventory + connector status (so Atlas never lies about what's
  // wired up).
  if (intent.kind === "capability_query") {
    const providers = getAIProviderStatuses();
    const n8n = getN8nConfigState();
    const toolLines = Object.values(TOOL_LABELS)
      .map((label) => `• ${label}`)
      .join("\n");
    const providerLines = providers
      .map((p) => {
        const status = !p.configured
          ? "missing key"
          : !p.enabled
          ? "disabled by owner"
          : "ready";
        return `• ${p.label} — ${status}`;
      })
      .join("\n");
    const n8nLine = n8n.configured
      ? "• n8n automation — configured"
      : "• n8n automation — not configured (drafts stay local)";
    const safetyLine =
      "Safety: live social publishing and live email sending are OFF by default. Everything I create lands as a draft for you to review.";
    const assistantText = `Here's what I can do right now:\n\n${toolLines}\n\nAI providers:\n${providerLines}\n${n8nLine}\n\n${safetyLine}`;
    const { data: capMsg } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        user_id: profile.id,
        role: "assistant",
        content: assistantText,
        metadata: {
          source: "atlas_capability_query",
          providers: providers.map((p) => ({
            id: p.id,
            configured: p.configured,
            enabled: p.enabled,
          })),
          n8n_configured: n8n.configured,
        },
      })
      .select("id")
      .single();
    await supabase
      .from("chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);
    await logUsage(profile, {
      module: "atlas",
      event_type: "capability_query",
      metadata: { thread_id: threadId },
    });
    return NextResponse.json({
      ok: true,
      thread_id: threadId,
      message_id: capMsg?.id ?? null,
      kind: "capability_query",
      content: assistantText,
      assistant_message: assistantText,
      provider: "atlas_tool",
      model: null,
      runtime_context: publicRuntimeContext(runtimeContext),
      usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
      knowledge: { count: 0, sources: [] },
    });
  }

  if (intent.kind !== "none" && canRunAtlasTools(profile)) {
    const toolResult = await runAtlasTool(intent, profile);
    if (toolResult.ok) {
      // Build the assistant message body. For draft-creation tools this is
      // the short "Created your X. Open it: <link>" confirmation. For the
      // explain_capabilities tool it's the rendered plain-English snapshot
      // of what Atlas can do, which providers are configured, and what the
      // owner needs to flip to unlock more.
      let assistantText: string;
      if (toolResult.kind === "explain_capabilities" && toolResult.capabilities) {
        assistantText = renderCapabilityMessage(toolResult.capabilities);
      } else {
        // Honest wording — always "Saved as draft" / "Saved to your
        // knowledge", never "Posted" or "Sent". Atlas does not perform live
        // external actions.
        const subjectByKind: Record<string, string> = {
          create_social: "social draft",
          create_email: "newsletter draft",
          create_calendar: "calendar item",
          create_knowledge_note: "knowledge note",
        };
        const subject = subjectByKind[toolResult.kind] ?? "draft";
        assistantText =
          toolResult.kind === "create_knowledge_note"
            ? `Saved as a ${subject}. Open the collection: ${toolResult.link}`
            : `Saved your ${subject} (not posted, not sent — review it first). Open it: ${toolResult.link}`;
      }
      const { data: toolMsg } = await supabase
        .from("chat_messages")
        .insert({
          thread_id: threadId,
          user_id: profile.id,
          role: "assistant",
          content: assistantText,
          metadata: {
            runtime_context: publicRuntimeContext(runtimeContext),
            tool_result: {
              kind: toolResult.kind,
              itemId: toolResult.itemId,
              link: toolResult.link,
              summary: toolResult.summary,
              // Title surfaces in MessageRow's ToolResultCard. Keep it so
              // the chip can show "Atlas capabilities" / "Refi options" etc.
              title: toolResult.title,
              // Structured capability data for the capability tool only.
              // Plain-text in `content` is the canonical render — this
              // payload lets the chip optionally show a richer card later.
              ...(toolResult.capabilities
                ? { capabilities: toolResult.capabilities }
                : {}),
            },
          },
        })
        .select("id")
        .single();
      await supabase
        .from("chat_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);
      await logUsage(profile, {
        module: "atlas",
        event_type: "tool_call",
        metadata: {
          thread_id: threadId,
          kind: toolResult.kind,
          item_id: toolResult.itemId,
        },
      });
      return NextResponse.json({
        ok: true,
        thread_id: threadId,
        message_id: toolMsg?.id ?? null,
        kind: "tool_call",
        tool_result: {
          kind: toolResult.kind,
          itemId: toolResult.itemId,
          link: toolResult.link,
          summary: toolResult.summary,
          title: toolResult.title,
          ...(toolResult.capabilities
            ? { capabilities: toolResult.capabilities }
            : {}),
        },
        content: assistantText,
        assistant_message: assistantText,
        provider: "atlas_tool",
        model: null,
        runtime_context: publicRuntimeContext(runtimeContext),
        usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
        knowledge: { count: 0, sources: [] },
      });
    }
    // Friendly failure — log internally with the raw error for debugging,
    // surface a plain-English message to the chat so the user can recover.
    console.error("atlas_tool_failed", toolResult);
    const friendly = friendlyToolFailure(toolResult.kind, toolResult.message);
    const { data: errMsg } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        user_id: profile.id,
        role: "assistant",
        content: friendly,
        metadata: {
          runtime_context: publicRuntimeContext(runtimeContext),
          source: "atlas_tool_failure",
          kind: toolResult.kind,
          error: toolResult.error,
        },
      })
      .select("id")
      .single();
    await supabase
      .from("chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);
    await logUsage(profile, {
      module: "atlas",
      event_type: "tool_call_failed",
      metadata: {
        thread_id: threadId,
        kind: toolResult.kind,
        error: toolResult.error,
      },
    });
    return NextResponse.json({
      ok: true,
      thread_id: threadId,
      message_id: errMsg?.id ?? null,
      kind: "tool_call_failed",
      content: friendly,
      assistant_message: friendly,
      provider: "atlas_tool",
      model: null,
      runtime_context: publicRuntimeContext(runtimeContext),
      usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
      knowledge: { count: 0, sources: [] },
    });
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
  let projectBlock = "";
  try {
    if (effectiveAssistantId) {
      const { data: assistant } = await supabase
        .from("atlas_assistants")
        .select("name,description,system_prompt")
        .eq("id", effectiveAssistantId)
        .maybeSingle();
      if (assistant) {
        projectBlock = [
          "## Active Atlas project",
          `Name: ${assistant.name}`,
          assistant.description ? `Description: ${assistant.description}` : "",
          assistant.system_prompt
            ? `Project instructions:\n${assistant.system_prompt}`
            : "Project instructions: none supplied.",
        ]
          .filter(Boolean)
          .join("\n");
      }
      knowledgeHits = await retrieveForAssistant({
        assistant_id: effectiveAssistantId,
        message,
        limit: 5,
      });
      knowledgeBlock = renderKnowledgeBlock(knowledgeHits);
      runtimeContext = attachKnowledgeHitsToRuntimeContext(runtimeContext, knowledgeHits);
    }
  } catch (e) {
    console.error("knowledge retrieval failed", e);
  }
  if (loanRetrievalResult) {
    runtimeContext = withLoanRuntimeContext(runtimeContext, loanRetrievalResult);
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
  // Per-user AI Twin persona: load this user's private agent memory + relevant
  // saved/shared skills and inject them so Atlas answers AS them. Degrade-safe:
  // if the agent_* tables aren't applied, this silently no-ops.
  let personaBlock = "";
  try {
    const agentType = defaultAgentForRole(profile.role);
    const [mem, skl] = await Promise.all([
      loadAgentMemory(supabase, profile.id, agentType),
      loadAgentSkills(supabase, profile.id, agentType),
    ]);
    const blocks = [
      renderMemoryBlock(mem.memories),
      renderSkillsBlock(selectRelevantSkills(skl.skills, message)),
    ].filter(Boolean);
    if (blocks.length) {
      personaBlock = ["## Your persona & saved skills (answer in this voice)", ...blocks].join("\n\n");
    }
  } catch (e) {
    console.error("agent persona load failed", e);
  }

  // loanContextText is set above ONLY when a loan was matched in memory. It
  // leads the system blocks so the grounded loan context + response format take
  // priority; the persona block follows so Atlas adopts the user's voice.
  const systemBlocks = [loanContextText, personaBlock, projectBlock, knowledgeBlock].filter(
    Boolean
  );
  const runtimeContextBlock = renderAtlasRuntimeContextBlock(runtimeContext);
  const messages = systemBlocks.length > 0
    ? [
        ...baseMessages,
        {
          role: "system" as const,
          content: `(Context attached by the LegendsOS retrieval layer):\n\n${[
            runtimeContextBlock,
            ...systemBlocks,
          ].join(
            "\n\n"
          )}`,
        },
        // Re-inject the user's last message after the system block so the
        // provider answers the user, not the system. The user message is
        // already in baseMessages, but re-stating keeps it adjacent.
      ]
    : baseMessages;
  if (systemBlocks.length === 0) {
    messages.push({
      role: "system" as const,
      content: `(Context attached by the LegendsOS retrieval layer):\n\n${runtimeContextBlock}`,
    });
  }

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
      content: result.message,
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
        knowledge_sources: knowledgeHits.map((h) => ({
          title: h.title,
          source_path: h.source_path,
        })),
        runtime_context: publicRuntimeContext(runtimeContext),
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
    runtime_context: publicRuntimeContext(runtimeContext),
    loan_context:
      loanRetrievalResult?.matchStatus === "matched" && loanRetrievalResult.memory
        ? {
            borrower_name: loanRetrievalResult.memory.borrower_name,
            loan_number: loanRetrievalResult.memory.loan_number,
            current_stage: loanRetrievalResult.memory.current_stage,
            last_update:
              loanRetrievalResult.memory.last_known_activity ??
              loanRetrievalResult.memory.updated_at ??
              null,
            main_blocker: loanRetrievalResult.memory.main_blocker,
            next_action: loanRetrievalResult.memory.next_action,
            confidence: loanRetrievalResult.memory.confidence,
            sources_checked:
              loanRetrievalResult.sourcesChecked ??
              loanRetrievalResult.panel?.sources_checked ??
              [],
            match_status: "matched",
            is_sample: loanRetrievalResult.memory.is_sample,
          }
        : null,
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
