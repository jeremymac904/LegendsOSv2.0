import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { CollectionItemsTabs } from "@/components/knowledge/CollectionItemsTabs";
import { CollapsibleSection } from "@/components/knowledge/CollapsibleSection";
import { CreateKnowledgeItem } from "@/components/knowledge/CreateKnowledgeItem";
import { KnowledgeUploadCard } from "@/components/knowledge/KnowledgeUploadCard";
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

  const col = collection as KnowledgeCollection;

  const fileRows = fileItems.map((it) => ({
    id: it.id,
    title: it.title,
    meta: `${(it.metadata as { mime_type?: string })?.mime_type ?? "file"} · ${formatRelative(it.created_at)}`,
  }));
  const noteRows = noteItems.map((it) => ({
    id: it.id,
    title: it.title,
    sourceType: it.source_type ?? "note",
    content: it.content ?? null,
    addedLabel: formatDate(it.created_at),
  }));

  return (
    <div className="space-y-4">
      <Link href="/knowledge" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Knowledge
      </Link>
      <SectionHeader
        eyebrow="Collection"
        title={col.name}
        description={col.description ?? ""}
        action={
          <StatusPill
            status={col.visibility === "team_shared" ? "ok" : "info"}
            label={col.visibility.replace("_", " ")}
          />
        }
      />

      <CollapsibleSection
        title="Add to this collection"
        description="Upload files or paste a reference. Atlas picks them up on its next reply."
        icon={Plus}
        defaultOpen={itemList.length === 0}
        badge={
          <span className="chip-info">
            {fileItems.length + noteItems.length} item(s)
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <KnowledgeUploadCard
            collectionId={col.id}
            userId={profile.id}
            organizationId={profile.organization_id}
          />
          <CreateKnowledgeItem
            collectionId={col.id}
            userId={profile.id}
            organizationId={profile.organization_id}
          />
        </div>
      </CollapsibleSection>

      <CollectionItemsTabs files={fileRows} notes={noteRows} />
    </div>
  );
}
