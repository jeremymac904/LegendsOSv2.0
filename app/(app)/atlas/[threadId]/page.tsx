import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AtlasChatClient } from "@/components/atlas/AtlasChatClient";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { threadId: string };
}

export default async function AtlasThreadPage({ params }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

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
      />
    </div>
  );
}
