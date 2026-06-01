import { AtlasWorkspace } from "@/components/atlas/AtlasWorkspace";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AtlasAssistant, KnowledgeCollection } from "@/types/database";

import { buildAtlasModelCatalog } from "./model-catalog";
import {
  loadAtlasRuntimeContext,
  type AtlasRuntimeContext,
} from "@/lib/atlas/runtimeContext";

export const dynamic = "force-dynamic";

export default async function AtlasIndexPage({
  searchParams,
}: {
  searchParams?: { prompt?: string };
}) {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  // "Send to Atlas" deep-link: other surfaces (Vibe Coding, Builder) can link
  // to /atlas?prompt=<encoded> to pre-fill the composer for a new chat.
  const initialInput = (searchParams?.prompt ?? "").slice(0, 8000);
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  // Render-safety: a transient query-promise rejection should degrade to an
  // empty workspace rather than a 500 dropping the authed shell. We default
  // every dataset to null (→ empty arrays below) and only fill them on the
  // happy path. Casts are unchanged from the original happy-path code.
  let assistants: unknown = null;
  let threadRows: unknown = null;
  let collections: unknown = null;
  let itemCounts: unknown = null;
  let accessRows: { assistant_id: string; collection_id: string }[] = [];

  try {
    const [a, t, c, i] = await Promise.all([
      supabase
        .from("atlas_assistants")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("chat_threads")
        .select("*")
        .eq("user_id", profile.id)
        .eq("is_archived", false)
        .order("last_message_at", { ascending: false })
        .limit(24),
      supabase
        .from("knowledge_collections")
        .select("id,name,description,visibility")
        .order("updated_at", { ascending: false }),
      supabase.from("knowledge_items").select("collection_id"),
    ]);
    assistants = a.data;
    threadRows = t.data;
    collections = c.data;
    itemCounts = i.data;
  } catch {
    // Leave the defaults (null → empty arrays below); render an empty workspace.
  }

  const assistantList = (assistants ?? []) as AtlasAssistant[];
  try {
    const { data } = assistantList.length
      ? await supabase
          .from("assistant_knowledge_access")
          .select("assistant_id,collection_id")
          .in(
            "assistant_id",
            assistantList.map((a) => a.id)
          )
      : { data: [] as { assistant_id: string; collection_id: string }[] };
    accessRows = (data ?? []) as { assistant_id: string; collection_id: string }[];
  } catch {
    accessRows = [];
  }
  const itemCountMap = new Map<string, number>();
  for (const row of (itemCounts ?? []) as { collection_id: string | null }[]) {
    if (!row.collection_id) continue;
    itemCountMap.set(row.collection_id, (itemCountMap.get(row.collection_id) ?? 0) + 1);
  }
  const projectAccess = Object.fromEntries(
    assistantList.map((assistant) => [
      assistant.id,
      ((accessRows ?? []) as { assistant_id: string; collection_id: string }[])
        .filter((row) => row.assistant_id === assistant.id)
        .map((row) => row.collection_id),
    ])
  );
  const textProviders = getAIProviderStatuses().filter((p) =>
    ["openrouter", "deepseek", "nvidia", "minimax"].includes(p.id)
  );
  const models = buildAtlasModelCatalog(env);

  const envDefault = env.AI_DEFAULT_TEXT_PROVIDER as
    | "openrouter"
    | "deepseek"
    | "nvidia"
    | "minimax"
    | undefined;
  const envDefaultStatus = textProviders.find((p) => p.id === envDefault);
  const fallback = textProviders.find((p) => p.configured && p.enabled);
  const defaultProvider =
    (envDefaultStatus?.configured && envDefaultStatus?.enabled
      ? envDefault
      : (fallback?.id as "openrouter" | "deepseek" | "nvidia" | "minimax" | undefined)) ??
    "openrouter";
  let initialRuntimeContext: Awaited<ReturnType<typeof loadAtlasRuntimeContext>>;
  try {
    initialRuntimeContext = await loadAtlasRuntimeContext({
      client: supabase,
      profile,
      assistantId: null,
      provider: defaultProvider,
      model: null,
    });
  } catch {
    // Transient runtime-context failure degrades to an empty (but valid)
    // context so the workspace still renders instead of 500-ing the shell.
    initialRuntimeContext = emptyAtlasRuntimeContext(defaultProvider);
  }

  return (
    <AtlasWorkspace
      ownerId={profile.id}
      currentThread={null}
      initialInput={initialInput}
      assistants={assistantList}
      providerCatalog={textProviders.map((p) => ({
        id: p.id as "openrouter" | "deepseek" | "nvidia" | "minimax",
        label: p.label,
        configured: p.configured,
        enabled: p.enabled,
      }))}
      modelCatalog={models}
      defaultProvider={defaultProvider}
      initialRuntimeContext={initialRuntimeContext}
      organizationId={profile.organization_id}
      projects={assistantList}
      knowledgeCollections={((collections ?? []) as Pick<
        KnowledgeCollection,
        "id" | "name" | "description" | "visibility"
      >[]).map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        visibility: collection.visibility,
        item_count: itemCountMap.get(collection.id) ?? 0,
      }))}
      projectAccess={projectAccess}
      recentThreads={(threadRows ?? []) as {
        id: string;
        title: string;
        assistant_id: string | null;
        last_message_at: string | null;
        is_archived: boolean;
      }[]}
    />
  );
}

// Minimal, valid runtime context used when loadAtlasRuntimeContext() throws on a
// transient failure. Every sub-section reports an honest "error" status so the
// workspace renders empty instead of dropping the authed shell to the root
// boundary.
function emptyAtlasRuntimeContext(
  provider: string | null
): AtlasRuntimeContext {
  return {
    agent_type: "owner_atlas",
    current_assistant: {
      id: null,
      name: "Default Atlas",
      description: null,
      instructions_loaded: false,
    },
    model: { provider: provider ?? null, model: null },
    memory: { status: "error", items: [] },
    skills: { status: "error", items: [] },
    loan: {
      status: "not_requested",
      match_status: null,
      borrower_name: null,
      loan_number: null,
      current_stage: null,
      main_blocker: null,
      sources_checked: [],
    },
    browser: { status: "error", captures: [] },
    knowledge: {
      status: "error",
      attached_sources: [],
      retrieved_sources: [],
    },
    tools: { loaded: false, items: [] },
  };
}
