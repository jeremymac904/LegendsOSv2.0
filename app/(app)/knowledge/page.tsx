import Link from "next/link";
import {
  BookOpen,
  ExternalLink,
  FolderTree,
  Lock,
  PlayCircle,
  PlugZap,
  Users2,
} from "lucide-react";

import { CreateCollectionForm } from "@/components/knowledge/CreateCollectionForm";
import { KnowledgeTabs } from "@/components/knowledge/KnowledgeTabs";
import { QuickUploadPicker } from "@/components/knowledge/QuickUploadPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { KnowledgeCollection, KnowledgeItem } from "@/types/database";

export const dynamic = "force-dynamic";

type RecentItem = Pick<
  KnowledgeItem,
  | "id"
  | "title"
  | "source_type"
  | "collection_id"
  | "created_at"
  | "user_id"
  | "content"
  | "metadata"
>;

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
      .select(
        "id,title,source_type,collection_id,created_at,user_id,content,metadata"
      )
      .order("created_at", { ascending: false })
      .limit(20),
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
  const recent = (recentItems ?? []) as RecentItem[];
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
  // quick-upload picker in the Upload tab.
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

  // ---- Tab panels (each built from the already-fetched server data) -------

  const uploadPanel = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
      <QuickUploadPicker
        userId={profile.id}
        organizationId={profile.organization_id}
        collections={writableCollections}
      />
      <aside className="space-y-4">
        <CreateCollectionForm
          userId={profile.id}
          organizationId={profile.organization_id}
          canShare={profile.role === "owner"}
        />
        <div className="card-padded text-xs text-ink-600 dark:text-ink-300">
          <p className="label">Privacy</p>
          <p className="mt-2">
            Source files and embeddings live in Supabase under your user
            folder. RLS enforces who can read them. Owner ({profile.role === "owner" ? "you" : "Jeremy"})
            has cross-team read access.
          </p>
        </div>
      </aside>
    </div>
  );

  const collectionsPanel = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>My collections</h2>
            <p>Only you can see these unless you mark them team-shared.</p>
          </div>
          <span className="chip-info">
            <Lock size={12} />
            private
          </span>
        </div>
        <div className="scrollbar-thin mt-4 grid max-h-[28rem] grid-cols-1 gap-2 overflow-y-auto pr-1">
          {priv.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No private collections yet"
              description="Create one from the Upload tab to start adding source material."
            />
          ) : (
            priv.map((c) => (
              <Link
                key={c.id}
                href={`/knowledge/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-3 transition hover:border-accent-gold/40 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:border-accent-gold/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                    {c.name}
                  </p>
                  <p className="truncate text-xs text-ink-600 dark:text-ink-300">
                    {c.description}
                  </p>
                </div>
                <span className="shrink-0 pl-3 text-xs text-ink-500 dark:text-ink-400">
                  {itemsByCollection.get(c.id) ?? 0} items · {formatRelative(c.updated_at)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Team-shared collections</h2>
            <p>Visible to every member of the organization.</p>
          </div>
          <span className="chip-ok">
            <Users2 size={12} />
            team shared
          </span>
        </div>
        <div className="scrollbar-thin mt-4 grid max-h-[28rem] grid-cols-1 gap-2 overflow-y-auto pr-1">
          {team.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No team-shared collections yet"
              description="Jeremy can promote any collection to team-shared visibility."
            />
          ) : (
            team.map((c) => (
              <Link
                key={c.id}
                href={`/knowledge/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-3 transition hover:border-accent-gold/40 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:border-accent-gold/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                    {c.name}
                  </p>
                  <p className="truncate text-xs text-ink-600 dark:text-ink-300">
                    {c.description}
                  </p>
                </div>
                <StatusPill status="info" label="shared" />
              </Link>
            ))
          )}
        </div>
      </section>

      {isOwner(profile) && imports.length > 0 && (
        <section className="card-padded lg:col-span-2">
          <div className="section-title">
            <div>
              <h2>Local knowledge imports</h2>
              <p>
                Collections seeded by{" "}
                <code>scripts/import-local-knowledge.ts</code>. Re-run{" "}
                <code>npm run import-local-knowledge</code> after dropping new
                files into <code>future/</code>.
              </p>
            </div>
            <span className="chip-info">
              <FolderTree size={12} />
              {imports.length} sources
            </span>
          </div>
          <div className="scrollbar-thin mt-4 max-h-[20rem] overflow-auto rounded-xl border border-ink-200 dark:border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:bg-ink-900/70 dark:text-ink-400">
                <tr>
                  <th className="px-3 py-2">Collection</th>
                  <th className="px-3 py-2">Visibility</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Last imported</th>
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
    </div>
  );

  const recentPanel = (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Recent files</h2>
          <p>
            Newest items across collections you can read. Status reflects how
            Atlas can actually use each file right now.
          </p>
        </div>
        <span className="chip">{recent.length} shown</span>
      </div>
      <div className="scrollbar-thin mt-4 grid max-h-[32rem] gap-2 overflow-y-auto pr-1">
        {recent.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No items yet"
            description="Items appear here as soon as you add them to a collection."
          />
        ) : (
          recent.map((it) => {
            const indexed = isIndexedForSearch(it);
            return (
              <Link
                key={it.id}
                href={`/knowledge/${it.collection_id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm transition hover:border-accent-gold/40 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:border-accent-gold/30"
              >
                <span className="min-w-0 truncate text-ink-900 dark:text-ink-100">
                  {it.title}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="chip">{it.source_type ?? "note"}</span>
                  <StatusPill
                    status={indexed.status}
                    label={indexed.label}
                  />
                  <span className="text-ink-500 dark:text-ink-400">
                    {formatRelative(it.created_at)}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        <span className="font-medium text-ink-600 dark:text-ink-300">
          Indexed
        </span>{" "}
        = text was extracted and is keyword-searchable by Atlas now.{" "}
        <span className="font-medium text-ink-600 dark:text-ink-300">
          Filename only
        </span>{" "}
        = binary stored and browseable, but full-content embedding is pending a
        future server-side parsing pass. No file is marked ready until its text
        is genuinely available.
      </p>
    </section>
  );

  const setupPanel = <KnowledgeSetupGuide tutorialUrl={tutorialUrl} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Knowledge Sources"
        title="Reference material for Atlas"
        description="Upload files, paste text, and link sources. Private by default; team-shared when you flip the toggle."
      />

      <KnowledgeTabs
        upload={uploadPanel}
        collections={collectionsPanel}
        recent={recentPanel}
        setup={setupPanel}
      />
    </div>
  );
}

/**
 * Honest per-item indexing status. We do NOT invent a "ready" embedding state:
 * an item is keyword-searchable only when its text was actually extracted at
 * upload (plain-text formats set `metadata.extracted_text` / store `content`).
 * Everything else is stored + browseable but flagged "filename only" until the
 * deferred server-side parsing/embedding pass runs.
 */
function isIndexedForSearch(
  it: Pick<RecentItem, "content" | "metadata">
): { status: "ok" | "warn"; label: string } {
  const meta = (it.metadata ?? {}) as Record<string, unknown>;
  const extracted = meta.extracted_text === true;
  const hasContent =
    typeof it.content === "string" && it.content.trim().length > 0;
  if (extracted || hasContent) {
    return { status: "ok", label: "indexed" };
  }
  return { status: "warn", label: "filename only" };
}

function KnowledgeSetupGuide({ tutorialUrl }: { tutorialUrl: string }) {
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
    <section className="card-padded">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <div className="section-title">
            <div>
              <h2>Knowledge setup guide</h2>
              <p>
                A visible onboarding lane for source uploads, collection
                routing, and Atlas retrieval checks.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {steps.map((s, index) => (
              <div
                key={s.title}
                className="rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-950/40"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent-gold">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">
                  {s.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <Link href="/settings" className="btn-ghost mt-4 w-fit text-xs">
            <PlugZap size={14} />
            Review connections
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-950/80">
          {tutorialUrl ? (
            <iframe
              src={tutorialUrl}
              title="Knowledge setup tutorial"
              className="aspect-video w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="grid aspect-video place-items-center bg-gradient-to-br from-ink-100 to-ink-50 p-6 text-center dark:from-ink-900 dark:via-ink-950 dark:to-black">
              <div className="max-w-sm">
                <PlayCircle
                  size={38}
                  className="mx-auto text-accent-gold/90"
                />
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
    </section>
  );
}
