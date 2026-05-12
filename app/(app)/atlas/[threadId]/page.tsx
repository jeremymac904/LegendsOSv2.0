import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AtlasChatClient } from "@/components/atlas/AtlasChatClient";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

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
      supabase
        .from("chat_threads")
        .select("*")
        .eq("id", params.threadId)
        .maybeSingle(),
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

  if (!thread) {
    notFound();
  }

  const textProviders = getAIProviderStatuses().filter((p) =>
    ["openrouter", "deepseek", "nvidia"].includes(p.id)
  );
  const models = {
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
  const defaultProvider =
    (textProviders.find((p) => p.configured && p.enabled)?.id as
      | "openrouter"
      | "deepseek"
      | "nvidia"
      | undefined) ?? "openrouter";

  return (
    <div className="space-y-5">
      <Link href="/atlas" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        All threads
      </Link>
      <SectionHeader
        eyebrow="Atlas Chat"
        title={(thread as ChatThread).title}
        description="All messages persist with RLS. Replies are logged as usage events."
      />
      <AtlasChatClient
        initialThreadId={params.threadId}
        initialMessages={(messages ?? []) as ChatMessage[]}
        assistants={(assistants ?? []) as AtlasAssistant[]}
        ownerId={profile.id}
        initialAssistantId={(thread as ChatThread).assistant_id ?? null}
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
