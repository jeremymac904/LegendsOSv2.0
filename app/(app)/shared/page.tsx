import { Sparkles } from "lucide-react";

import { CreateSharedResourceForm } from "@/components/shared/CreateSharedResourceForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { SharedResource } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SharedResourcesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("shared_resources")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const resources = (data ?? []) as SharedResource[];
  const owner = isOwner(profile);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Shared Resources"
        title="Owner-curated team assets"
        description="Prompts, templates, files, and brand assets Jeremy makes available to every team member. Read-only for the team; owner-managed."
        action={
          <StatusPill status={owner ? "ok" : "info"} label={owner ? "owner" : "viewer"} />
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Active resources</h2>
              <p>What every member of the org can use today.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {resources.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No shared resources yet"
                description={
                  owner
                    ? "Add prompts, copy templates, and PDFs on the right. They become available to every team member."
                    : "Jeremy has not shared any resources yet. Check back later."
                }
              />
            ) : (
              resources.map((r) => (
                <article
                  key={r.id}
                  className="rounded-xl border border-ink-800 bg-ink-900/40 p-4"
                >
                  <header className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-ink-100">
                      {r.title}
                    </h3>
                    <span className="chip">{r.resource_type}</span>
                  </header>
                  {r.description && (
                    <p className="mt-1 text-xs text-ink-300">{r.description}</p>
                  )}
                  <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-ink-400">
                    Updated {formatRelative(r.updated_at)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="space-y-4">
          {owner ? (
            <CreateSharedResourceForm
              organizationId={profile.organization_id}
              userId={profile.id}
            />
          ) : (
            <div className="card-padded text-xs text-ink-300">
              <p className="label">Adding resources</p>
              <p className="mt-2">
                Only the owner can add or remove shared resources. Suggest
                additions to Jeremy directly.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
