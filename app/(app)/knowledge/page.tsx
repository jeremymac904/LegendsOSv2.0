import Link from "next/link";
import {
  ExternalLink,
  FolderTree,
  PlayCircle,
  PlugZap,
  Upload,
} from "lucide-react";

import { CollapsibleSection } from "@/components/knowledge/CollapsibleSection";
import { CreateCollectionForm } from "@/components/knowledge/CreateCollectionForm";
import { KnowledgeBrowser } from "@/components/knowledge/KnowledgeBrowser";
import { QuickUploadPicker } from "@/components/knowledge/QuickUploadPicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { KnowledgeCollection, KnowledgeItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const tutorialUrl = process.env.NEXT_PUBLIC_KNOWLEDGE_TUTORIAL_URL ?? "";

  const [
    { data: privateCollections },
    { data: teamCollections },
    { data: recentItems },
    { data: importedCollections },
    { data: itemCounts },
  ] = await Promise.all([
    supabase
      .from("knowledge_collections")
      .select("*")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("knowledge_collections")
      .select("*")
      .eq("visibility", "team_shared")
      .order("updated_at", { ascending: false }),
    supabase
      .from("knowledge_items")
      .select("id,title,source_type,collection_id,created_at,user_id")
      .order("created_at", { ascending: false })
      .limit(8),
    // "Local Knowledge Imports" — collections produced by the local
    // importer (we tag them via metadata.seeded_by). The same .eq() against
    // a jsonb field uses PostgREST's `->>` accessor syntax.
    supabase
      .from("knowledge_collections")
      .select("*")
      .eq("metadata->>seeded_by", "scripts/import-local-knowledge.ts")
      .order("name", { ascending: true }),
    supabase
      .from("knowledge_items")
      .select("collection_id"),
  ]);

  const priv = (privateCollections ?? []) as KnowledgeCollection[];
  const team = (teamCollections ?? []) as KnowledgeCollection[];
  const recent = (recentItems ?? []) as Pick<
    KnowledgeItem,
    "id" | "title" | "source_type" | "collection_id" | "created_at" | "user_id"
  >[];
  const imports = (importedCollections ?? []) as KnowledgeCollection[];
  const itemsByCollection = new Map<string, number>();
  for (const ic of (itemCounts ?? []) as { collection_id: string | null }[]) {
    if (!ic.collection_id) continue;
    itemsByCollection.set(
      ic.collection_id,
      (itemsByCollection.get(ic.collection_id) ?? 0) + 1
    );
  }

  // Combined list of collections the user can write into — used by the
  // quick-upload picker at the top.
  const writableCollections: { id: string; name: string; visibility: "private" | "team_shared" }[] = [
    ...priv.map((c) => ({
      id: c.id,
      name: c.name,
      visibility: c.visibility as "private" | "team_shared",
    })),
    ...team
      .filter((c) => c.user_id === profile.id || isOwner(profile))
      .map((c) => ({
        id: c.id,
        name: c.name,
        visibility: c.visibility as "private" | "team_shared",
      })),
  ];

  const toRow = (c: KnowledgeCollection) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    updatedLabel: formatRelative(c.updated_at),
    itemCount: itemsByCollection.get(c.id) ?? 0,
  });
  const recentRows = recent.map((it) => ({
    id: it.id,
    title: it.title,
    collectionId: it.collection_id ?? null,
    sourceType: it.source_type ?? null,
    createdLabel: formatRelative(it.created_at),
  }));

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Knowledge Sources"
        title="Reference material for Atlas"
        description="Upload files, paste text, and link sources. Private by default; team-shared when you flip the toggle."
      />

      {/* Compact action row: upload (left, accordion) + create collection (right). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <CollapsibleSection
          title="Quick upload"
          description="Drop files straight into any collection — Atlas indexes the text on its next reply."
          icon={Upload}
          defaultOpen={writableCollections.length > 0}
          badge={
            <span className="chip-info">
              {writableCollections.length} target(s)
            </span>
          }
        >
          <QuickUploadPicker
            userId={profile.id}
            organizationId={profile.organization_id}
            collections={writableCollections}
          />
        </CollapsibleSection>

        <CreateCollectionForm
          userId={profile.id}
          organizationId={profile.organization_id}
          canShare={profile.role === "owner"}
        />
      </div>

      <KnowledgeBrowser
        privateCollections={priv.map(toRow)}
        teamCollections={team.map(toRow)}
        recent={recentRows}
      />

      {isOwner(profile) && imports.length > 0 && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Local knowledge imports</h2>
              <p>
                Collections seeded by{" "}
                <code>scripts/import-local-knowledge.ts</code>. Re-run{" "}
                <code>npm run import-local-knowledge</code> after dropping
                new files into <code>future/</code>.
              </p>
            </div>
            <span className="chip-info">
              <FolderTree size={12} />
              {imports.length} sources
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Collection</th>
                  <th className="px-3 py-2 font-medium">Visibility</th>
                  <th className="px-3 py-2 font-medium">Items</th>
                  <th className="px-3 py-2 font-medium">Last imported</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((c) => {
                  const count = itemsByCollection.get(c.id) ?? 0;
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-ink-200 dark:border-ink-800"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/knowledge/${c.id}`}
                          className="font-medium text-ink-900 hover:text-accent-gold dark:text-ink-100"
                        >
                          {c.name}
                        </Link>
                        {c.description && (
                          <p className="line-clamp-1 text-[11px] text-ink-600 dark:text-ink-300">
                            {c.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          status={c.visibility === "team_shared" ? "ok" : "info"}
                          label={c.visibility.replace("_", " ")}
                        />
                      </td>
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                        {count}
                      </td>
                      <td className="px-3 py-2 text-ink-600 dark:text-ink-300">
                        {formatRelative(c.updated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <KnowledgeSetupGuide tutorialUrl={tutorialUrl} role={profile.role} />
    </div>
  );
}

function KnowledgeSetupGuide({
  tutorialUrl,
  role,
}: {
  tutorialUrl: string;
  role: string;
}) {
  const steps = [
    {
      title: "Upload source files",
      body: "PDF, DOCX, PPTX, Markdown, text, CSV, JSON, and image files route into collections for Atlas retrieval.",
    },
    {
      title: "Share the right collections",
      body: "Keep private material locked down, then promote team-safe sources when Atlas should use them for everyone.",
    },
    {
      title: "Connect automations",
      body: "Use Settings to review n8n and MCP connection status before asking Atlas to act on source material.",
    },
  ];

  return (
    <CollapsibleSection
      title="Knowledge setup guide"
      description="Onboarding for source uploads, collection routing, and Atlas retrieval checks."
      icon={PlugZap}
      defaultOpen={false}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <div className="grid gap-2">
            {steps.map((s, index) => (
              <div
                key={s.title}
                className="rounded-xl border border-ink-200 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent-gold">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">
                  {s.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <Link href="/settings" className="btn-ghost mt-4 w-fit text-xs">
            <PlugZap size={14} />
            Review connections
          </Link>
          <p className="mt-4 text-xs text-ink-600 dark:text-ink-300">
            <span className="label">Privacy</span>
            <br />
            Source files and embeddings live in Supabase under your user folder.
            RLS enforces who can read them. Owner ({role === "owner" ? "you" : "Jeremy"})
            has cross-team read access.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-950/80">
          {tutorialUrl ? (
            <iframe
              src={tutorialUrl}
              title="Knowledge setup tutorial"
              className="aspect-video w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="grid aspect-video place-items-center bg-gradient-to-br from-ink-50 via-white to-ink-100 p-6 text-center dark:from-ink-900 dark:via-ink-950 dark:to-black">
              <div className="max-w-sm">
                <PlayCircle size={38} className="mx-auto text-accent-gold/90" />
                <p className="mt-3 text-sm font-medium text-ink-900 dark:text-ink-100">
                  Tutorial video slot
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  Add a hosted walkthrough URL with{" "}
                  <code>NEXT_PUBLIC_KNOWLEDGE_TUTORIAL_URL</code> to embed the
                  setup video here.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-3 py-2 text-xs text-ink-600 dark:border-ink-800 dark:text-ink-300">
            <span>Atlas-ready source setup</span>
            <Link
              href="/atlas"
              className="inline-flex items-center gap-1 text-accent-gold hover:text-accent-gold-300"
            >
              Test retrieval
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
