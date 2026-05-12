import Link from "next/link";
import { MessageCircle, Plus, Sparkles } from "lucide-react";

import { AtlasChatClient } from "@/components/atlas/AtlasChatClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv } from "@/lib/env";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
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

  const providerStatus = [
    { id: "openrouter", configured: Boolean(env.OPENROUTER_API_KEY) },
    { id: "deepseek", configured: Boolean(env.DEEPSEEK_API_KEY) },
    { id: "nvidia", configured: Boolean(env.NVIDIA_API_KEY) },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Atlas Chat"
        title="Hermes-style internal assistant"
        description="Source-grounded, role-aware, and logged. Pick an assistant on the right or start a fresh thread below."
        action={
          <div className="flex flex-wrap gap-2">
            {providerStatus.map((p) => (
              <StatusPill
                key={p.id}
                status={p.configured ? "configured" : "missing"}
                label={`${p.id}: ${p.configured ? "ready" : "missing"}`}
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
              <p>Pick an assistant or use the default Atlas profile.</p>
            </div>
            <span className="chip-info">
              <Sparkles size={12} />
              Compliance line auto-applied
            </span>
          </div>
          <AtlasChatClient
            initialThreadId={null}
            assistants={assistantList}
            ownerId={profile.id}
          />
        </section>
      </div>
    </div>
  );
}
