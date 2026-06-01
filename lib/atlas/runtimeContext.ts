import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isMissingTableError,
  readCaptures,
  type BrowserCompanionCaptureRow,
} from "@/lib/browserCompanion/store";
import { buildCapabilitySnapshot } from "@/lib/atlas/toolRouter";
import type { KnowledgeHit } from "@/lib/atlas/retrieval";
import type { LoanRetrievalResult } from "@/lib/loanMemory/retrievalMiddleware";
import type { Profile } from "@/types/database";

export type AtlasAgentType =
  | "owner_atlas"
  | "lo_atlas"
  | "processor_flo"
  | "coordinator_agent";

export interface AtlasRuntimeMemory {
  id: string;
  title: string;
  category: string;
  body: string;
  priority: string | null;
  confidence: string | null;
  updated_at: string | null;
}

export interface AtlasRuntimeSkill {
  id: string;
  skill_name: string;
  description: string | null;
  visibility: string | null;
  is_shared_with_team: boolean | null;
  trigger_phrases: unknown;
  steps: unknown;
  usage_count: number | null;
}

export interface AtlasRuntimeKnowledgeSource {
  id: string;
  name: string;
  visibility: string | null;
  item_count?: number;
}

export interface AtlasRuntimeBrowserContext {
  id: string;
  source_title: string | null;
  source_url: string | null;
  selected_excerpt: string | null;
  structured_keys: string[];
  routed_assistant: string | null;
  captured_at: string;
}

export interface AtlasRuntimeContext {
  agent_type: AtlasAgentType;
  current_assistant: {
    id: string | null;
    name: string;
    description: string | null;
    instructions_loaded: boolean;
  };
  model: {
    provider: string | null;
    model: string | null;
  };
  memory: {
    status: "loaded" | "none" | "setup_needed" | "error";
    items: AtlasRuntimeMemory[];
  };
  skills: {
    status: "loaded" | "none" | "setup_needed" | "error";
    items: AtlasRuntimeSkill[];
  };
  loan: {
    status: "not_requested" | "matched" | "clarify" | "no_match" | "error";
    match_status: string | null;
    borrower_name: string | null;
    loan_number: string | null;
    current_stage: string | null;
    main_blocker: string | null;
    sources_checked: string[];
  };
  browser: {
    status: "loaded" | "none" | "setup_needed" | "error";
    captures: AtlasRuntimeBrowserContext[];
  };
  knowledge: {
    status: "loaded" | "none" | "not_attached" | "error";
    attached_sources: AtlasRuntimeKnowledgeSource[];
    retrieved_sources: {
      title: string;
      source_path: string | null;
      score: number;
    }[];
  };
  tools: {
    loaded: boolean;
    items: { id: string; label: string; description: string }[];
  };
}

function agentTypeForProfile(profile: Profile): AtlasAgentType {
  if (profile.role === "owner" || profile.role === "admin") return "owner_atlas";
  if (profile.role === "processor") return "processor_flo";
  if (profile.role === "coordinator") return "coordinator_agent";
  return "lo_atlas";
}

function trimText(value: unknown, max = 700): string | null {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeCapture(row: BrowserCompanionCaptureRow): AtlasRuntimeBrowserContext {
  const structured = asRecord(row.structured_context);
  return {
    id: row.id,
    source_title: row.source_title,
    source_url: row.source_url,
    selected_excerpt: trimText(row.selected_text, 900),
    structured_keys: Object.keys(structured).slice(0, 12),
    routed_assistant: row.routed_assistant,
    captured_at: row.captured_at,
  };
}

async function readAgentMemories(
  client: SupabaseClient,
  profile: Profile,
  agentType: AtlasAgentType
): Promise<AtlasRuntimeContext["memory"]> {
  try {
    const { data, error } = await client
      .from("agent_memories")
      .select("id,title,category,body,priority,confidence,updated_at")
      .eq("user_id", profile.id)
      .eq("agent_type", agentType)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(8);

    if (error) {
      if (isMissingTableError(error)) return { status: "setup_needed", items: [] };
      return { status: "error", items: [] };
    }

    const items = ((data ?? []) as AtlasRuntimeMemory[]).map((item) => ({
      ...item,
      body: trimText(item.body, 700) ?? "",
    }));
    return { status: items.length ? "loaded" : "none", items };
  } catch (err) {
    if (isMissingTableError(err)) return { status: "setup_needed", items: [] };
    return { status: "error", items: [] };
  }
}

async function readAgentSkills(
  client: SupabaseClient,
  profile: Profile,
  agentType: AtlasAgentType
): Promise<AtlasRuntimeContext["skills"]> {
  try {
    const { data, error } = await client
      .from("agent_skills")
      .select(
        "id,skill_name,description,visibility,is_shared_with_team,trigger_phrases,steps,usage_count"
      )
      .eq("agent_type", agentType)
      .eq("is_active", true)
      .or(`user_id.eq.${profile.id},is_shared_with_team.eq.true`)
      .order("usage_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(8);

    if (error) {
      if (isMissingTableError(error)) return { status: "setup_needed", items: [] };
      return { status: "error", items: [] };
    }

    const items = (data ?? []) as AtlasRuntimeSkill[];
    return { status: items.length ? "loaded" : "none", items };
  } catch (err) {
    if (isMissingTableError(err)) return { status: "setup_needed", items: [] };
    return { status: "error", items: [] };
  }
}

async function readKnowledgeSources(
  client: SupabaseClient,
  assistantId: string | null
): Promise<AtlasRuntimeContext["knowledge"]> {
  if (!assistantId) {
    return { status: "not_attached", attached_sources: [], retrieved_sources: [] };
  }
  try {
    const { data: access, error: accessError } = await client
      .from("assistant_knowledge_access")
      .select("collection_id")
      .eq("assistant_id", assistantId);

    if (accessError) return { status: "error", attached_sources: [], retrieved_sources: [] };

    const ids = ((access ?? []) as { collection_id: string }[]).map((row) => row.collection_id);
    if (!ids.length) {
      return { status: "not_attached", attached_sources: [], retrieved_sources: [] };
    }

    const [{ data: collections }, { data: counts }] = await Promise.all([
      client
        .from("knowledge_collections")
        .select("id,name,visibility")
        .in("id", ids)
        .order("updated_at", { ascending: false }),
      client.from("knowledge_items").select("collection_id").in("collection_id", ids),
    ]);
    const countMap = new Map<string, number>();
    for (const row of (counts ?? []) as { collection_id: string | null }[]) {
      if (!row.collection_id) continue;
      countMap.set(row.collection_id, (countMap.get(row.collection_id) ?? 0) + 1);
    }
    const attached_sources = ((collections ?? []) as AtlasRuntimeKnowledgeSource[]).map(
      (source) => ({
        ...source,
        item_count: countMap.get(source.id) ?? 0,
      })
    );
    return {
      status: attached_sources.length ? "loaded" : "not_attached",
      attached_sources,
      retrieved_sources: [],
    };
  } catch {
    return { status: "error", attached_sources: [], retrieved_sources: [] };
  }
}

function loanContextFromRetrieval(
  retrieval: LoanRetrievalResult | null | undefined
): AtlasRuntimeContext["loan"] {
  if (!retrieval?.loanRelated) {
    return {
      status: "not_requested",
      match_status: null,
      borrower_name: null,
      loan_number: null,
      current_stage: null,
      main_blocker: null,
      sources_checked: [],
    };
  }

  if (retrieval.matchStatus === "matched") {
    return {
      status: "matched",
      match_status: "matched",
      borrower_name: retrieval.memory?.borrower_name ?? retrieval.panel?.borrower ?? null,
      loan_number: retrieval.memory?.loan_number ?? retrieval.panel?.loan_number ?? null,
      current_stage: retrieval.memory?.current_stage ?? retrieval.panel?.current_stage ?? null,
      main_blocker: retrieval.memory?.main_blocker ?? retrieval.panel?.open_blocker ?? null,
      sources_checked: retrieval.sourcesChecked ?? retrieval.panel?.sources_checked ?? [],
    };
  }

  return {
    status:
      retrieval.matchStatus === "multiple_matches" || retrieval.matchStatus === "low_confidence"
        ? "clarify"
        : "no_match",
    match_status: retrieval.matchStatus ?? null,
    borrower_name: null,
    loan_number: null,
    current_stage: null,
    main_blocker: null,
    sources_checked: retrieval.sourcesChecked ?? ["loan_memory"],
  };
}

export async function loadAtlasRuntimeContext(args: {
  client: SupabaseClient;
  profile: Profile;
  assistantId: string | null;
  provider: string | null | undefined;
  model: string | null | undefined;
  loanRetrieval?: LoanRetrievalResult | null;
}): Promise<AtlasRuntimeContext> {
  const agentType = agentTypeForProfile(args.profile);
  const capability = buildCapabilitySnapshot();

  const [{ data: assistant }, memory, skills, knowledge, capturesResult] =
    await Promise.all([
      args.assistantId
        ? args.client
            .from("atlas_assistants")
            .select("id,name,description,system_prompt")
            .eq("id", args.assistantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      readAgentMemories(args.client, args.profile, agentType),
      readAgentSkills(args.client, args.profile, agentType),
      readKnowledgeSources(args.client, args.assistantId),
      readCaptures(args.client, {
        user_id: args.profile.id,
        organization_id: args.profile.organization_id,
        all: false,
        limit: 5,
      }),
    ]);

  const browser: AtlasRuntimeContext["browser"] = !capturesResult.provisioned
    ? { status: "setup_needed", captures: [] }
    : !capturesResult.ok
    ? { status: "error", captures: [] }
    : {
        status: capturesResult.data?.length ? "loaded" : "none",
        captures: (capturesResult.data ?? []).slice(0, 5).map(normalizeCapture),
      };

  return {
    agent_type: agentType,
    current_assistant: {
      id: (assistant as { id?: string } | null)?.id ?? args.assistantId,
      name: (assistant as { name?: string } | null)?.name ?? "Default Atlas",
      description: (assistant as { description?: string | null } | null)?.description ?? null,
      instructions_loaded: Boolean(
        (assistant as { system_prompt?: string | null } | null)?.system_prompt
      ),
    },
    model: {
      provider: args.provider ?? null,
      model: args.model ?? null,
    },
    memory,
    skills,
    loan: loanContextFromRetrieval(args.loanRetrieval),
    browser,
    knowledge,
    tools: {
      loaded: true,
      items: capability.tools,
    },
  };
}

export function attachKnowledgeHitsToRuntimeContext(
  context: AtlasRuntimeContext,
  hits: KnowledgeHit[]
): AtlasRuntimeContext {
  return {
    ...context,
    knowledge: {
      ...context.knowledge,
      status: hits.length
        ? "loaded"
        : context.knowledge.attached_sources.length
        ? context.knowledge.status
        : context.knowledge.status,
      retrieved_sources: hits.map((hit) => ({
        title: hit.title,
        source_path: hit.source_path,
        score: hit.score,
      })),
    },
  };
}

export function withLoanRuntimeContext(
  context: AtlasRuntimeContext,
  retrieval: LoanRetrievalResult | null | undefined
): AtlasRuntimeContext {
  return {
    ...context,
    loan: loanContextFromRetrieval(retrieval),
  };
}

export function publicRuntimeContext(context: AtlasRuntimeContext): AtlasRuntimeContext {
  return context;
}

function renderJsonArray(value: unknown, fallback: string): string {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .slice(0, 5)
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .join("; ");
}

export function renderAtlasRuntimeContextBlock(context: AtlasRuntimeContext): string {
  const lines: string[] = [
    "## Atlas operating context",
    `Current assistant: ${context.current_assistant.name}`,
    `Model selected: ${context.model.provider ?? "default"} / ${context.model.model ?? "provider default"}`,
    `Assistant instructions loaded: ${context.current_assistant.instructions_loaded ? "yes" : "no"}`,
  ];

  lines.push("");
  lines.push("### Assistant memory loaded before response");
  if (context.memory.items.length) {
    for (const item of context.memory.items.slice(0, 6)) {
      lines.push(`- ${item.title} (${item.category}, ${item.confidence ?? "medium"}): ${item.body}`);
    }
  } else {
    lines.push(`- ${context.memory.status}`);
  }

  lines.push("");
  lines.push("### Assistant skills loaded before response");
  if (context.skills.items.length) {
    for (const skill of context.skills.items.slice(0, 6)) {
      lines.push(
        `- ${skill.skill_name}: ${skill.description ?? "No description."} Triggers: ${renderJsonArray(
          skill.trigger_phrases,
          "none listed"
        )}`
      );
    }
  } else {
    lines.push(`- ${context.skills.status}`);
  }

  lines.push("");
  lines.push("### Browser companion context loaded before response");
  if (context.browser.captures.length) {
    for (const capture of context.browser.captures.slice(0, 3)) {
      lines.push(
        `- ${capture.source_title ?? "Untitled page"} (${capture.source_url ?? "no url"}): ${
          capture.selected_excerpt ?? `structured keys: ${capture.structured_keys.join(", ") || "none"}`
        }`
      );
    }
  } else {
    lines.push(`- ${context.browser.status}`);
  }

  lines.push("");
  lines.push("### Loaded knowledge sources");
  if (context.knowledge.attached_sources.length) {
    for (const source of context.knowledge.attached_sources.slice(0, 8)) {
      lines.push(`- ${source.name} (${source.item_count ?? 0} item(s), ${source.visibility ?? "unknown"})`);
    }
  } else {
    lines.push(`- ${context.knowledge.status}`);
  }

  lines.push("");
  lines.push("### Loan memory status");
  lines.push(
    `- ${context.loan.status}${
      context.loan.borrower_name ? `: ${context.loan.borrower_name}` : ""
    }${context.loan.loan_number ? ` / ${context.loan.loan_number}` : ""}`
  );

  lines.push("");
  lines.push("### Loaded tools");
  for (const tool of context.tools.items) {
    lines.push(`- ${tool.label}: ${tool.description}`);
  }

  return lines.join("\n");
}
