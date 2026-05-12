import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Pencil } from "lucide-react";

import { CreateKnowledgeItem } from "@/components/knowledge/CreateKnowledgeItem";
import { KnowledgeUploadCard } from "@/components/knowledge/KnowledgeUploadCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatDate, formatRelative } from "@/lib/utils";
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
  const fileItems = itemList.filter((i) => i.source_type === "file");
  const noteItems = itemList.filter((i) => i.source_type !== "file");

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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <KnowledgeUploadCard
          collectionId={(collection as KnowledgeCollection).id}
          userId={profile.id}
          organizationId={profile.organization_id}
        />
        <CreateKnowledgeItem
          collectionId={(collection as KnowledgeCollection).id}
          userId={profile.id}
          organizationId={profile.organization_id}
        />
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Files in this collection</h2>
            <p>{fileItems.length} file(s) uploaded.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fileItems.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No files yet"
              description="Upload a PDF, DOCX, image, or any reference file using the card above."
            />
          ) : (
            fileItems.map((it) => (
              <div
                key={it.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-100">
                    {it.title}
                  </p>
                  <p className="text-[11px] text-ink-300">
                    {(it.metadata as { mime_type?: string })?.mime_type ?? "file"} ·{" "}
                    {formatRelative(it.created_at)}
                  </p>
                </div>
                <span className="chip text-[10px]">file</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Notes & references</h2>
            <p>{noteItems.length} pasted text reference(s).</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {noteItems.length === 0 ? (
            <EmptyState
              icon={Pencil}
              title="No notes yet"
              description="Paste reference content using the 'Add item' card above."
            />
          ) : (
            noteItems.map((it) => (
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
    </div>
  );
}

