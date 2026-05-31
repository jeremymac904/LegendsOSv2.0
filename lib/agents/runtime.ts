// LegendsOS v2 — Agent runtime (the shared brain)
// ---------------------------------------------------------------------------
// One orchestrator every role-based agent runs through:
//   resolve agent -> load context bundle (memory, skills, role rules, loan
//   memory, browser context, connection status, session history) -> assemble
//   the system prompt -> REAL model call via lib/ai/providers.runChat ->
//   persist session + messages -> write a Hermes-style trace -> detect skill
//   triggers -> auto-create drafts for clear draft intents.
//
// Degrade-safe: if the agent_* tables aren't applied yet, the agent still
// answers (statelessly) and reports degraded=true. If no model provider is
// configured, it returns an honest setup-needed result — never a fake answer.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { runChat } from "@/lib/ai/providers";
import { PUBLIC_ENV } from "@/lib/env";
import { isLoanRelated } from "@/lib/loanMemory/detect";
import { isMissingDatabaseObjectError } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

import { loadAgentMemory, renderMemoryBlock } from "./memory";
import { canUseAgent, getAgent } from "./registry";
import {
  detectSkillTrigger,
  loadAgentSkills,
  renderSkillsBlock,
  selectRelevantSkills,
} from "./skills";
import {
  draftEmail,
  draftSocialPost,
  runBrowserContextRead,
  runConnectionStatus,
  runKnowledgeSearch,
  runLoanMemoryLookup,
} from "./tools";
import { writeTrace } from "./traces";
import type {
  AgentChatInput,
  AgentChatResult,
  ContextSource,
} from "./types";

type AnyClient = SupabaseClient<any, any, any>;

const MAX_HISTORY = 16;

export async function runAgentChat(
  client: AnyClient,
  profile: Profile,
  input: AgentChatInput
): Promise<AgentChatResult> {
  const startedAt = Date.now();
  const agent = getAgent(input.agentType);

  if (!canUseAgent(profile, input.agentType)) {
    return {
      ok: false,
      error: "forbidden",
      message: `Your role can't use the ${agent.name} agent.`,
    };
  }

  const message = (input.message ?? "").trim();
  if (!message) {
    return { ok: false, error: "bad_request", message: "Message is required." };
  }

  // ---- 1. Resolve / create the session (degrade-safe) --------------------
  let sessionId = input.sessionId ?? null;
  let degraded = false;
  if (!sessionId) {
    const created = await createSession(client, profile, input);
    sessionId = created.id;
    if (created.degraded) degraded = true;
  }

  // ---- 2. Build the context bundle --------------------------------------
  const sources: ContextSource[] = [];
  const systemBlocks: string[] = [];
  const toolsCalled: string[] = [];
  const skillsUsed: string[] = [];

  // Persona (identity) — always first so it becomes messages[0].
  const persona = agent.buildSystemPrompt({
    userName: profile.full_name,
    brandLine: PUBLIC_ENV.BRAND_LINE,
  });

  // Private per-user memory.
  const mem = await loadAgentMemory(client, profile.id, input.agentType);
  if (mem.degraded) degraded = true;
  if (mem.memories.length) {
    systemBlocks.push(renderMemoryBlock(mem.memories));
    sources.push({ label: "user_memory", detail: `${mem.memories.length} memories` });
  }

  // Relevant skills.
  const skl = await loadAgentSkills(client, profile.id, input.agentType);
  if (skl.degraded) degraded = true;
  const relevant = selectRelevantSkills(skl.skills, message);
  if (relevant.length) {
    systemBlocks.push(renderSkillsBlock(relevant));
    relevant.forEach((s) => skillsUsed.push(s.skill_name));
    sources.push({ label: "user_skills", detail: `${relevant.length} skills` });
  }

  // Per-user voice/tone (reuse existing user_ai_preferences — don't duplicate).
  const tone = await loadTone(client, profile.id);
  if (tone) {
    systemBlocks.push(`## Tone preference\n- ${tone}`);
    sources.push({ label: "tone_preference", detail: tone });
  }

  // Browser Companion context.
  if (input.browserContext) {
    const bc = await runBrowserContextRead(input.browserContext);
    if (bc.contextText) {
      systemBlocks.push(bc.contextText);
      toolsCalled.push("browser_context_read");
      sources.push({ label: "browser_context", detail: bc.summary });
    }
  }

  // Loan memory (only loan-aware agents, only loan-related messages).
  if (agent.loanAware && isLoanRelated(message)) {
    const lm = await runLoanMemoryLookup(client, message);
    if (lm.contextText) {
      systemBlocks.push(lm.contextText);
      toolsCalled.push("loan_memory_lookup");
      sources.push({ label: "loan_memory", detail: lm.summary });
    }
  }

  // Knowledge search (best-effort; cheap keyword RAG).
  const ks = await runKnowledgeSearch(client, message);
  if (ks.contextText) {
    systemBlocks.push(ks.contextText);
    toolsCalled.push("knowledge_search");
    sources.push({ label: "knowledge", detail: ks.summary });
  }

  // Connection status — only when the user actually references Gmail/Drive.
  const lowerMsg = message.toLowerCase();
  if (/\bgmail\b|\bemail inbox\b/.test(lowerMsg)) {
    const g = await runConnectionStatus(client, profile.id, "gmail");
    if (g.contextText) systemBlocks.push(g.contextText);
    toolsCalled.push("gmail_status_check");
    sources.push({ label: "gmail_status", detail: g.summary });
  }
  if (/\bdrive\b|\bgoogle drive\b/.test(lowerMsg)) {
    const d = await runConnectionStatus(client, profile.id, "google_drive");
    if (d.contextText) systemBlocks.push(d.contextText);
    toolsCalled.push("drive_status_check");
    sources.push({ label: "drive_status", detail: d.summary });
  }

  // ---- 3. Assemble messages (history + this turn) ------------------------
  const history = sessionId ? await loadHistory(client, sessionId) : [];
  const systemContent = [persona, ...systemBlocks].filter(Boolean).join("\n\n");
  const messages = [
    { role: "system" as const, content: systemContent },
    ...history,
    { role: "user" as const, content: message },
  ];

  // ---- 4. REAL model call ------------------------------------------------
  const result = await runChat({
    provider: input.provider ?? undefined,
    model: input.model ?? undefined,
    messages,
    max_tokens: 1600,
  } as Parameters<typeof runChat>[0]);

  if (!("ok" in result) || !result.ok) {
    const err = result as { error: string; message: string; env_var?: string };
    const setupNeeded =
      err.error === "provider_not_configured" || err.error === "provider_disabled";
    return {
      ok: false,
      error: err.error,
      message: err.message,
      setupNeeded,
      envVar: err.env_var ?? null,
    };
  }

  const content = result.content || "(The model returned an empty response.)";

  // ---- 5. Persist user + assistant messages ------------------------------
  await persistMessage(client, sessionId, profile.id, input.agentType, "user", message, null, null);
  const assistantMsgId = await persistMessage(
    client,
    sessionId,
    profile.id,
    input.agentType,
    "assistant",
    content,
    result.provider,
    result.model
  );
  if (sessionId) await touchSession(client, sessionId);

  // ---- 6. Auto-draft for clear draft intents (real, safe, draft-only) ----
  let appended = "";
  const draftNote = await maybeCreateDraft(client, profile, sessionId, input.agentType, message, content);
  if (draftNote) {
    appended = `\n\n_${draftNote.note}_`;
    toolsCalled.push(draftNote.tool);
  }

  // ---- 7. Trace ----------------------------------------------------------
  const traceId = await writeTrace(client, {
    sessionId,
    messageId: assistantMsgId,
    userId: profile.id,
    agentType: input.agentType,
    inputSummary: message.slice(0, 200),
    contextLoaded: sources.map((s) => s.label),
    skillsUsed,
    toolsCalled,
    provider: result.provider,
    modelUsed: result.model,
    outputType: draftNote ? draftNote.tool : "chat",
    durationMs: Date.now() - startedAt,
  });

  // ---- 8. Skill-save suggestion ------------------------------------------
  const skillSuggestion = detectSkillTrigger(message);

  return {
    ok: true,
    sessionId,
    messageId: assistantMsgId,
    traceId,
    content: content + appended,
    provider: result.provider,
    model: result.model,
    contextSources: sources,
    skillsUsed,
    toolsCalled,
    degraded,
    skillSuggestion,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createSession(
  client: AnyClient,
  profile: Profile,
  input: AgentChatInput
): Promise<{ id: string | null; degraded: boolean }> {
  try {
    const { data, error } = await client
      .from("agent_sessions")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        agent_type: input.agentType,
        title: input.message.slice(0, 80),
        loan_id: input.loanId ?? null,
        origin: input.origin ?? "web",
        status: "active",
      })
      .select("id")
      .maybeSingle();
    if (error) {
      return { id: null, degraded: isMissingDatabaseObjectError(error) };
    }
    return { id: (data?.id as string | undefined) ?? null, degraded: false };
  } catch (error) {
    return { id: null, degraded: isMissingDatabaseObjectError(error) };
  }
}

async function loadHistory(
  client: AnyClient,
  sessionId: string
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  try {
    const { data, error } = await client
      .from("agent_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);
    if (error || !data) return [];
    return data
      .map((m: Record<string, unknown>) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content ?? ""),
      }))
      .filter((m) => m.content);
  } catch {
    return [];
  }
}

async function persistMessage(
  client: AnyClient,
  sessionId: string | null,
  userId: string,
  agentType: AgentChatInput["agentType"],
  role: "user" | "assistant",
  content: string,
  provider: string | null,
  model: string | null
): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const { data, error } = await client
      .from("agent_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        agent_type: agentType,
        role,
        content,
        provider,
        model,
      })
      .select("id")
      .maybeSingle();
    if (error) return null;
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

async function touchSession(client: AnyClient, sessionId: string): Promise<void> {
  try {
    await client
      .from("agent_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch {
    // best-effort
  }
}

async function loadTone(client: AnyClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("user_ai_preferences")
      .select("tone_profile, communication_rules")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const tone = (data.tone_profile as string | undefined) ?? null;
    const rules = (data.communication_rules as string | undefined) ?? null;
    return [tone && `voice: ${tone}`, rules].filter(Boolean).join("; ") || null;
  } catch {
    return null;
  }
}

/**
 * Deterministic draft creation for unambiguous intents. The model already
 * wrote the content; we persist it as a DRAFT in the right studio. Never sends.
 */
async function maybeCreateDraft(
  client: AnyClient,
  profile: Profile,
  sessionId: string | null,
  agentType: AgentChatInput["agentType"],
  message: string,
  content: string
): Promise<{ tool: string; note: string } | null> {
  const lower = message.toLowerCase();
  const agent = getAgent(agentType);
  const wantsSocial =
    agent.tools.includes("draft_social_post") &&
    /\b(draft|write|create|make)\b.*\b(post|caption|facebook|instagram|gbp|google business|social)\b/.test(lower);
  const wantsEmail =
    agent.tools.includes("draft_email") &&
    /\b(draft|write|create|make)\b.*\b(email|newsletter)\b/.test(lower);

  if (wantsSocial) {
    const res = await draftSocialPost(client, profile, sessionId, agentType, {
      body: content.slice(0, 5000),
      title: message.slice(0, 80),
    });
    if (res.ok) return { tool: "draft_social_post", note: "Saved as a Social Studio draft for your review. Nothing was published." };
    if (res.degraded) return { tool: "draft_social_post", note: "Draft not saved — Social Studio storage isn't provisioned yet (setup needed)." };
  } else if (wantsEmail) {
    const res = await draftEmail(client, profile, sessionId, agentType, {
      subject: message.slice(0, 120),
      bodyText: content.slice(0, 8000),
    });
    if (res.ok) return { tool: "draft_email", note: "Saved as an Email Studio draft for your review. Nothing was sent." };
    if (res.degraded) return { tool: "draft_email", note: "Draft not saved — Email Studio storage isn't provisioned yet (setup needed)." };
  }
  return null;
}
