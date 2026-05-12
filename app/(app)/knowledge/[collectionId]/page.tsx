import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";

import { CreateKnowledgeItem } from "@/components/knowledge/CreateKnowledgeItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { KnowledgeCollection, KnowledgeItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
}: {
  params: { collectionId: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

  const { data: collection } = await supabase
    .from("knowledge_collections")
    .select("*")
    .eq("id", params.collectionId)
    .maybeSingle();

  if (!collection) notFound();

  const { data: items } = await supabase
    .from("knowledge_items")
    .select("*")
    .eq("collection_id", params.collectionId)
    .order("updated_at", { ascending: false });

  const itemList = (items ?? []) as KnowledgeItem[];

  return (
    <div className="space-y-6">
      <Link href="/knowledge" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Knowledge
      </Link>
      <SectionHeader
        eyebrow="Collection"
        title={(collection as KnowledgeCollection).name}
        description={(collection as KnowledgeCollection).description ?? ""}
        action={
          <StatusPill
            status={
              (collection as KnowledgeCollection).visibility === "team_shared"
                ? "ok"
                : "info"
            }
            label={(collection as KnowledgeCollection).visibility.replace("_", " ")}
          />
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Items</h2>
              <p>Source text and uploaded references in this collection.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {itemList.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No items yet"
                description="Use the form on the right to add the first source."
              />
            ) : (
              itemList.map((it) => (
                <div
                  key={it.id}
                  className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-100">{it.title}</p>
                    <span className="chip text-[10px]">
                      {it.source_type ?? "note"}
                    </span>
                  </div>
                  {it.content && (
                    <p className="mt-2 line-clamp-3 text-xs text-ink-300">
                      {it.content}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ink-400">
                    Added {formatDate(it.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <CreateKnowledgeItem
            collectionId={(collection as KnowledgeCollection).id}
            userId={profile.id}
            organizationId={profile.organization_id}
          />
        </aside>
      </div>
    </div>
  );
}
