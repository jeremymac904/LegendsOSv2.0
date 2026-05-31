import { SharedWorkspace } from "@/components/shared/SharedWorkspace";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  SHARED_REVIEW_RESOURCE_TYPE,
  reviewItemFromShared,
} from "@/lib/teamResources";
import type { SharedResource } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SharedResourcesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const owner = isOwner(profile);

  // Team-facing list: published, active resources (review items are excluded —
  // they live in the owner's review queue until published).
  const { data: activeData } = await supabase
    .from("shared_resources")
    .select("*")
    .eq("is_active", true)
    .neq("resource_type", SHARED_REVIEW_RESOURCE_TYPE)
    .order("updated_at", { ascending: false });

  const activeResources = ((activeData ?? []) as SharedResource[]).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    resource_type: r.resource_type,
    updated_at: r.updated_at,
  }));

  // Owner-only review queue: intake drafts (inactive review_item rows). RLS
  // already scopes by org; non-owners never query this.
  let reviewItems: ReturnType<typeof reviewItemFromShared>[] = [];
  if (owner) {
    const { data: reviewData } = await supabase
      .from("shared_resources")
      .select("*")
      .eq("resource_type", SHARED_REVIEW_RESOURCE_TYPE)
      .order("updated_at", { ascending: false });
    reviewItems = ((reviewData ?? []) as SharedResource[]).map(reviewItemFromShared);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Shared Resources"
        title="Owner-curated team assets"
        description="Paste content or upload a file, let an AI step recommend the title, summary, audience, sanitized + Legends-voice versions, and compliance notes, then publish what passes review. Read-only for the team; owner-managed."
        action={
          <StatusPill status={owner ? "ok" : "info"} label={owner ? "owner" : "viewer"} />
        }
      />
      <SharedWorkspace
        owner={owner}
        activeResources={activeResources}
        reviewItems={reviewItems}
      />
    </div>
  );
}
