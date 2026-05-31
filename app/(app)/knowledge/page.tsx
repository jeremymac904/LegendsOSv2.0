import Link from "next/link";
import {
  BookOpen,
  ExternalLink,
  FolderTree,
  Lock,
  PlugZap,
  Users2,
} from "lucide-react";

import { CreateCollectionForm } from "@/components/knowledge/CreateCollectionForm";
import { QuickUploadPicker } from "@/components/knowledge/QuickUploadPicker";
import { EmptyState } from "@/components/ui/EmptyState";
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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Knowledge Sources"
        title="Reference material for Atlas"
        description="Upload files, paste text, and link sources. Private by default; team-shared when you flip the toggle."
      />

      <QuickUploadPicker
        userId={profile.id}
        organizationId={profile.organization_id}
        collections={writableCollections}
      />

      <KnowledgeSetupGuide tutorialUrl={tutorialUrl} />

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
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
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
                    <tr key={c.id} className="border-t border-ink-800">
                      <td className="px-3 py-2">
                        <Link
                          href={`/knowledge/${c.id}`}
                          className="font-medium text-ink-100 hover:text-accent-gold"
                        >
                          {c.name}
                        </Link>
                        {c.description && (
                          <p className="line-clamp-1 text-[11px] text-ink-300">
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
                      <td className="px-3 py-2 text-ink-100">{count}</td>
                      <td className="px-3 py-2 text-ink-300">
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
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
            <div className="mt-4 grid grid-cols-1 gap-2">
              {priv.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No private collections yet"
                  description="Create one on the right to start uploading source material."
                />
              ) : (
                priv.map((c) => (
                  <Link
                    key={c.id}
                    href={`/knowledge/${c.id}`}
                    className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-3 transition hover:border-accent-gold/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-100">{c.name}</p>
                      <p className="text-xs text-ink-300">{c.description}</p>
                    </div>
                    <span className="text-xs text-ink-300">
                      {formatRelative(c.updated_at)}
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
            <div className="mt-4 grid grid-cols-1 gap-2">
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
                    className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-100">{c.name}</p>
                      <p className="text-xs text-ink-300">{c.description}</p>
                    </div>
                    <StatusPill status="info" label="shared" />
                  </Link>
                ))
              )}
            </div>
          </section>
          <section className="card-padded">
            <div className="section-title">
              <div>
                <h2>Recent items</h2>
                <p>Across all collections you can read.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {recent.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No items yet"
                  description="Items appear as soon as you add them to a collection."
                />
              ) : (
                recent.map((it) => (
                  <Link
                    key={it.id}
                    href={`/knowledge/${it.collection_id}`}
                    className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-ink-100">{it.title}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-300">
                      <span className="chip">{it.source_type ?? "note"}</span>
                      {formatRelative(it.created_at)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          <CreateCollectionForm
            userId={profile.id}
            organizationId={profile.organization_id}
            canShare={profile.role === "owner"}
          />
          <div className="card-padded text-xs text-ink-300">
            <p className="label">Privacy</p>
            <p className="mt-2">
              Source files and embeddings live in Supabase under your user
              folder. RLS enforces who can read them. Owner ({profile.role === "owner" ? "you" : "Jeremy"})
              has cross-team read access.
            </p>
          </div>
        </aside>
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
