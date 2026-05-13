import { notFound } from "next/navigation";

import { AtlasShell } from "@/components/atlas/AtlasShell";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

import { buildAtlasModelCatalog } from "../model-catalog";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { threadId: string };
}

export default async function AtlasThreadPage({ params }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const [{ data: thread }, { data: messages }, { data: assistants }] =
    await Promise.all([
      supabase.from("chat_threads").select("*").eq("id", params.threadId).maybeSingle(),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", params.threadId)
        .order("created_at", { ascending: true }),
      supabase
        .from("atlas_assistants")
        .select("*")
        .eq("is_active", true)
        .order("name"),
    ]);

  if (!thread) notFound();

  const textProviders = getAIProviderStatuses().filter((p) =>
    ["openrouter", "deepseek", "nvidia"].includes(p.id)
  );
  const models = buildAtlasModelCatalog(env);
  const envDefault = env.AI_DEFAULT_TEXT_PROVIDER as
    | "openrouter"
    | "deepseek"
    | "nvidia"
    | undefined;
  const envDefaultStatus = textProviders.find((p) => p.id === envDefault);
  const fallback = textProviders.find((p) => p.configured && p.enabled);
  const defaultProvider =
    (envDefaultStatus?.configured && envDefaultStatus?.enabled
      ? envDefault
      : (fallback?.id as "openrouter" | "deepseek" | "nvidia" | undefined)) ??
    "openrouter";

  return (
    <AtlasShell
      ownerId={profile.id}
      currentThread={thread as ChatThread}
      initialMessages={(messages ?? []) as ChatMessage[]}
      assistants={(assistants ?? []) as AtlasAssistant[]}
      providerCatalog={textProviders.map((p) => ({
        id: p.id as "openrouter" | "deepseek" | "nvidia",
        label: p.label,
        configured: p.configured,
        enabled: p.enabled,
      }))}
      modelCatalog={models}
      defaultProvider={defaultProvider}
    />
  );
}
