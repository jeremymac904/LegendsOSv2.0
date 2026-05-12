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
  const defaultProvider =
    (textProviders.find((p) => p.configured && p.enabled)?.id as
      | "openrouter"
      | "deepseek"
      | "nvidia"
      | undefined) ?? "openrouter";

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
