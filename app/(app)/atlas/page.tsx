import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";

import { AtlasChatClient } from "@/components/atlas/AtlasChatClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
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
      .limit(50),
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

  // Only show text providers in the Atlas header.
  const textProviders = getAIProviderStatuses().filter((p) =>
    ["openrouter", "deepseek", "nvidia"].includes(p.id)
  );

  // Model lists used by the chat client. Empty array if provider missing.
  const models = {
    openrouter: env.OPENROUTER_API_KEY
      ? [
          { id: env.OPENROUTER_DEFAULT_MODEL, label: `default — ${env.OPENROUTER_DEFAULT_MODEL}` },
          ...env.OPENROUTER_FREE_MODELS.map((m) => ({ id: m, label: `free — ${m}` })),
        ]
      : [],
    deepseek: env.DEEPSEEK_API_KEY
      ? [{ id: env.DEEPSEEK_DEFAULT_MODEL, label: `default — ${env.DEEPSEEK_DEFAULT_MODEL}` }]
      : [],
    nvidia: env.NVIDIA_API_KEY
      ? [
          env.NVIDIA_MODELS.kimi_k2_5
            ? { id: env.NVIDIA_MODELS.kimi_k2_5, label: `Kimi K2 5 — ${env.NVIDIA_MODELS.kimi_k2_5}` }
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
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Atlas Chat"
        title="Source-grounded internal assistant"
        description="Pick a provider and model on the right or use the configured defaults. All messages are persisted and logged."
        action={
          <div className="flex flex-wrap gap-2">
            {textProviders.map((p) => (
              <StatusPill
                key={p.id}
                status={
                  p.configured
                    ? p.enabled
                      ? "configured"
                      : "disabled"
                    : "missing"
                }
                label={`${p.label}: ${
                  p.configured ? (p.enabled ? "ready" : "disabled") : "missing"
                }`}
              />
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Threads</h2>
              <p>Your recent conversations.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {threadList.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No threads yet"
                description="Send your first message to create a thread. Threads sync across devices."
              />
            ) : (
              threadList.map((t) => (
                <Link
                  key={t.id}
                  href={`/atlas/${t.id}`}
                  className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2 text-sm transition hover:border-accent-gold/30"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-ink-300">
                    {formatRelative(t.last_message_at ?? t.updated_at)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>New conversation</h2>
              <p>Pick an assistant, provider, and model.</p>
            </div>
            <span className="chip-info">
              <Sparkles size={12} />
              Branding line auto-applied
            </span>
          </div>
          <AtlasChatClient
            initialThreadId={null}
            assistants={assistantList}
            ownerId={profile.id}
            providerCatalog={textProviders.map((p) => ({
              id: p.id as "openrouter" | "deepseek" | "nvidia",
              label: p.label,
              configured: p.configured,
              enabled: p.enabled,
            }))}
            modelCatalog={models}
            defaultProvider={defaultProvider}
          />
        </section>
      </div>
    </div>
  );
}
