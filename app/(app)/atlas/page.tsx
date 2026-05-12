import { AtlasWorkspace } from "@/components/atlas/AtlasWorkspace";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { AtlasAssistant, ChatThread } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AtlasIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const [{ data: threads }, { data: assistants }] = await Promise.all([
    supabase
      .from("chat_threads")
      .select("id,title,last_message_at,updated_at,assistant_id")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase
      .from("atlas_assistants")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const threadList = (threads ?? []) as Pick<
    ChatThread,
    "id" | "title" | "last_message_at" | "updated_at" | "assistant_id"
  >[];
  const assistantList = (assistants ?? []) as AtlasAssistant[];

  const textProviders = getAIProviderStatuses().filter((p) =>
    ["openrouter", "deepseek", "nvidia"].includes(p.id)
  );
  const models = buildModelCatalog(env);
  const defaultProvider =
    (textProviders.find((p) => p.configured && p.enabled)?.id as
      | "openrouter"
      | "deepseek"
      | "nvidia"
      | undefined) ?? "openrouter";

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Atlas Chat"
        title="Source-grounded internal assistant"
        description="Pick a provider and model on the right. Drafts of every message are saved automatically."
        action={
          <div className="flex flex-wrap gap-2">
            {textProviders.map((p) => (
              <StatusPill
                key={p.id}
                status={
                  p.configured
                    ? p.enabled
                      ? "ok"
                      : "off"
                    : "missing"
                }
                label={`${p.label}: ${
                  p.configured ? (p.enabled ? "ready" : "off") : "missing"
                }`}
              />
            ))}
          </div>
        }
      />
      <AtlasWorkspace
        ownerId={profile.id}
        threads={threadList}
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
    </div>
  );
}

function buildModelCatalog(env: ReturnType<typeof getServerEnv>) {
  return {
    openrouter: env.OPENROUTER_API_KEY
      ? [
          {
            id: env.OPENROUTER_DEFAULT_MODEL,
            label: `default — ${env.OPENROUTER_DEFAULT_MODEL}`,
          },
          ...env.OPENROUTER_FREE_MODELS.map((m) => ({
            id: m,
            label: `free — ${m}`,
          })),
        ]
      : [],
    deepseek: env.DEEPSEEK_API_KEY
      ? [
          {
            id: env.DEEPSEEK_DEFAULT_MODEL,
            label: `default — ${env.DEEPSEEK_DEFAULT_MODEL}`,
          },
        ]
      : [],
    nvidia: env.NVIDIA_API_KEY
      ? [
          env.NVIDIA_MODELS.kimi_k2_5
            ? {
                id: env.NVIDIA_MODELS.kimi_k2_5,
                label: `Kimi K2 5 — ${env.NVIDIA_MODELS.kimi_k2_5}`,
              }
            : null,
          env.NVIDIA_MODELS.nemotron_super_120b
            ? {
                id: env.NVIDIA_MODELS.nemotron_super_120b,
                label: `Nemotron Super 120B — ${env.NVIDIA_MODELS.nemotron_super_120b}`,
              }
            : null,
          env.NVIDIA_MODELS.mistral_small_4_119b
            ? {
                id: env.NVIDIA_MODELS.mistral_small_4_119b,
                label: `Mistral Small 4 119B — ${env.NVIDIA_MODELS.mistral_small_4_119b}`,
              }
            : null,
        ].filter((m): m is { id: string; label: string } => m !== null)
      : [],
  };
}
