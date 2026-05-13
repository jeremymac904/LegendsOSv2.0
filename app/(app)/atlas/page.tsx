import { AtlasShell } from "@/components/atlas/AtlasShell";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { AtlasAssistant } from "@/types/database";

import { buildAtlasModelCatalog } from "./model-catalog";

export const dynamic = "force-dynamic";

export default async function AtlasIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const { data: assistants } = await supabase
    .from("atlas_assistants")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const assistantList = (assistants ?? []) as AtlasAssistant[];
  const textProviders = getAIProviderStatuses().filter((p) =>
    ["openrouter", "deepseek", "nvidia"].includes(p.id)
  );
  const models = buildAtlasModelCatalog(env);
  // Honor AI_DEFAULT_TEXT_PROVIDER when it points at a configured + enabled
  // provider; otherwise fall back to the first available one. This makes the
  // provider chip in the chat header match what the gateway actually calls.
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
      currentThread={null}
      assistants={assistantList}
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
