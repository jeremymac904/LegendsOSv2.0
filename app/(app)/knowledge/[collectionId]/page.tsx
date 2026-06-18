import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Database, FileText, Pencil } from "lucide-react";

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
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
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
            fileItems.map((it) => {
              const metadata = (it.metadata ?? {}) as {
                mime_type?: string;
                extracted_text?: boolean;
                storage_bucket?: string;
                storage_path?: string;
                size_bytes?: number;
              };
              const indexed = Boolean(metadata.extracted_text);
              return (
                <div
                  key={it.id}
                  className="rounded-xl border border-ink-200 bg-white/65 p-3 dark:border-ink-800 dark:bg-ink-900/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                        {it.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-300">
                        {metadata.mime_type ?? "file"} · added {formatRelative(it.created_at)}
                      </p>
                    </div>
                    <span className={indexed ? "chip-ok text-[10px]" : "chip text-[10px]"}>
                      {indexed ? "indexed" : "stored"}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1.5 text-[10.5px] text-ink-600 dark:text-ink-300">
                    <p className="flex items-center gap-1.5">
                      {indexed ? (
                        <CheckCircle2 size={11} className="text-status-ok" />
                      ) : (
                        <Database size={11} className="text-status-warn" />
                      )}
                      {indexed
                        ? "Atlas can keyword-search this file's text."
                        : "Stored as a source file. Atlas can match the title until text extraction is added."}
                    </p>
                    {metadata.storage_path && (
                      <p className="truncate">
                        Source: {metadata.storage_bucket ?? "knowledge"}/{metadata.storage_path}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
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
                className="rounded-xl border border-ink-200 bg-white/65 p-3 dark:border-ink-800 dark:bg-ink-900/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{it.title}</p>
                  <span className="chip-ok text-[10px]">
                    {it.source_type ?? "note"}
                  </span>
                </div>
                {it.content && (
                  <p className="mt-2 line-clamp-3 text-xs text-ink-700 dark:text-ink-300">
                    {it.content}
                  </p>
                )}
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  Indexed text · Added {formatDate(it.created_at)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
