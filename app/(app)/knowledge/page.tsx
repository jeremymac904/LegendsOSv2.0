import Link from "next/link";
import {
  BookOpen,
  Database,
  ExternalLink,
  FolderTree,
  Lock,
  PlugZap,
  Users2,
} from "lucide-react";

import { CreateCollectionForm } from "@/components/knowledge/CreateCollectionForm";
import { QuickUploadPicker } from "@/components/knowledge/QuickUploadPicker";
import { LocalTrainingAssetBrowser } from "@/components/training/LocalTrainingAssetBrowser";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { trainingAssetIndex, trainingAssets } from "@/lib/legends/trainingAssets";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { KnowledgeCollection, KnowledgeItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
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
      .limit(10),
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

  const writableCollections = [
    ...priv.map((c) => ({ id: c.id, name: c.name, visibility: c.visibility as any })),
    ...team.filter((c) => c.user_id === profile.id || isOwner(profile)).map((c) => ({ id: c.id, name: c.name, visibility: c.visibility as any })),
  ];

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[650px] flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          eyebrow="Knowledge Sources"
          title="Reference for Atlas"
          description="Manage training data and reference material."
        />
        <div className="flex items-center gap-2">
           <Link href="/atlas" className="btn py-1 text-xs"><BookOpen size={14} /> Open Atlas</Link>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_2.5fr]">
        {/* Sidebar: Add & Config */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
           <CreateCollectionForm
             userId={profile.id}
             organizationId={profile.organization_id}
             canShare={profile.role === "owner"}
           />
           <div className="card-padded py-3">
              <p className="label text-[10px] uppercase tracking-wider mb-2">Quick Upload</p>
              <QuickUploadPicker
                userId={profile.id}
                organizationId={profile.organization_id}
                collections={writableCollections}
              />
           </div>
           <KnowledgeSetupGuide tutorialUrl={tutorialUrl} />
        </div>

        {/* Main: Collections Tabs */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white/40 dark:border-ink-800 dark:bg-ink-950/20">
           <KnowledgeTabs
             priv={priv}
             team={team}
             imports={imports}
             recent={recent}
             itemsByCollection={itemsByCollection}
             isOwner={isOwner(profile)}
             localAssets={trainingAssets}
             localCounts={trainingAssetIndex.counts}
             driveLinks={trainingAssetIndex.driveLinks}
           />
        </div>
      </div>
    </div>
  );
}

function KnowledgeTabs({
  priv,
  team,
  imports,
  recent,
  itemsByCollection,
  isOwner,
  localAssets,
  localCounts,
  driveLinks,
}: any) {
  const tabs: TabItem[] = [
    {
      id: "my",
      label: `Private (${priv.length})`,
      icon: Lock,
      content: (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
           {priv.length === 0 ? (
             <div className="col-span-full py-10"><EmptyState icon={Lock} title="No private collections" description="Create one to start uploading." /></div>
           ) : (
             priv.map((c: any) => (
               <Link key={c.id} href={`/knowledge/${c.id}`} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white/50 p-3 dark:border-ink-800 dark:bg-ink-900/40 hover:border-accent-gold/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{c.name}</p>
                    <p className="truncate text-[10px] text-ink-500">{itemsByCollection.get(c.id) || 0} items</p>
                  </div>
                  <span className="text-[10px] text-ink-400">{formatRelative(c.updated_at)}</span>
               </Link>
             ))
           )}
        </div>
      )
    },
    {
      id: "team",
      label: `Team (${team.length})`,
      icon: Users2,
      content: (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
           {team.length === 0 ? (
             <div className="col-span-full py-10"><EmptyState icon={Users2} title="No team collections" description="Shared material appears here." /></div>
           ) : (
             team.map((c: any) => (
               <Link key={c.id} href={`/knowledge/${c.id}`} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white/50 p-3 dark:border-ink-800 dark:bg-ink-900/40 hover:border-accent-gold/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{c.name}</p>
                    <p className="truncate text-[10px] text-ink-500">{itemsByCollection.get(c.id) || 0} items</p>
                  </div>
                  <StatusPill status="info" label="shared" />
               </Link>
             ))
           )}
        </div>
      )
    },
    {
      id: "recent",
      label: "Recent Activity",
      icon: BookOpen,
      content: (
        <div className="space-y-2">
           {recent.length === 0 ? (
             <EmptyState icon={BookOpen} title="No recent items" description="Uploads appear here." />
           ) : (
             recent.map((it: any) => (
               <Link key={it.id} href={`/knowledge/${it.collection_id}`} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white/50 px-3 py-2 dark:border-ink-800 dark:bg-ink-900/40 hover:border-accent-gold/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="chip-off text-[9px] uppercase">{it.source_type || "note"}</span>
                    <p className="truncate text-sm text-ink-900 dark:text-ink-100">{it.title}</p>
                  </div>
                  <span className="text-[10px] text-ink-400">{formatRelative(it.created_at)}</span>
               </Link>
             ))
           )}
        </div>
      )
    }
  ];

  if (isOwner && imports.length > 0) {
    tabs.push({
      id: "imports",
      label: "Imports",
      icon: FolderTree,
      content: (
        <div className="space-y-2">
           {imports.map((c: any) => (
             <Link key={c.id} href={`/knowledge/${c.id}`} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white/50 p-3 dark:border-ink-800 dark:bg-ink-900/40 hover:border-accent-gold/30">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{c.name}</p>
                  <p className="truncate text-[10px] text-ink-500">{itemsByCollection.get(c.id) || 0} items · Seeded by scripts</p>
                </div>
                <span className="text-[10px] text-ink-400">{formatRelative(c.updated_at)}</span>
             </Link>
           ))}
        </div>
      )
    });
  }

  if (isOwner) {
    tabs.push({
      id: "local-training-assets",
      label: `Local Index (${localCounts.indexedAssets})`,
      icon: Database,
      content: (
        <LocalTrainingAssetBrowser
          assets={localAssets}
          counts={localCounts}
          driveLinks={driveLinks}
          title="Training and community source index"
          description="Read-only scan of local training, transcript, community, and coaching source folders. Use this before promoting files into Supabase knowledge collections."
          maxVisible={80}
          showLocalReferences
        />
      ),
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
       <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <Tabs tabs={tabs} variant="pill" />
       </div>
    </div>
  );
}

function KnowledgeSetupGuide({ tutorialUrl }: { tutorialUrl: string }) {
  const steps = [
    {
      title: "Upload source files",
      body: "Plain-text, Markdown, CSV and JSON have their body text indexed for Atlas keyword search. PDF, DOCX, PPTX and images are stored but their text is not extracted yet — Atlas only matches their file name.",
    },
    {
      title: "Share the right collections",
      body: "Keep private material locked down, then promote team-safe sources when Atlas should use them for everyone.",
    },
    {
      title: "Connect the collection to an assistant",
      body: "Atlas only reads a collection once it is wired to an assistant in Settings. Uploading alone does not put a file in front of any chat.",
    },
  ];

  const hasTutorial = Boolean(tutorialUrl);

  return (
    <details className="card-padded group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
            Knowledge setup guide
          </h2>
          <p className="text-xs text-ink-600 dark:text-ink-400">
            How uploads, sharing, and Atlas retrieval actually work. Tap to
            expand.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400 group-open:hidden">
          Show
        </span>
        <span className="hidden text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400 group-open:inline">
          Hide
        </span>
      </summary>

      <div
        className={
          hasTutorial
            ? "mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
            : "mt-4"
        }
      >
        <div>
          <div className="grid gap-2">
            {steps.map((s, index) => (
              <div
                key={s.title}
                className="rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/40 p-3"
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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/settings" className="btn-ghost w-fit text-xs">
              <PlugZap size={14} />
              Review connections
            </Link>
            <Link
              href="/atlas"
              className="inline-flex items-center gap-1 text-xs text-accent-gold hover:text-accent-gold-300"
            >
              Open Atlas
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
        {hasTutorial && (
          <div className="overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950/80">
            <iframe
              src={tutorialUrl}
              title="Knowledge setup tutorial"
              className="aspect-video w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 dark:border-ink-800 px-3 py-2 text-xs text-ink-700 dark:text-ink-300">
              <span>Connect a collection, then test retrieval</span>
              <Link href="/atlas" className="inline-flex items-center gap-1 text-accent-gold hover:text-accent-gold-300">
                Open Atlas
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
