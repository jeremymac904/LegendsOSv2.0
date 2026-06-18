import { notFound } from "next/navigation";

import { ResourceDetail } from "@/components/resources/ResourceDetail";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  MARKETING_RESOURCE_TYPE,
  findTeamResource,
  relatedResourcesFor,
  resourceFromShared,
} from "@/lib/teamResources";
import type { SharedResource } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { materialId: string };
}

export default async function MarketingMaterialDetailPage({ params }: PageProps) {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("shared_resources")
    .select("*")
    .eq("resource_type", MARKETING_RESOURCE_TYPE)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const sharedItems = ((data ?? []) as SharedResource[]).map(resourceFromShared);
  const item = findTeamResource("marketing", params.materialId, sharedItems);
  if (!item) notFound();
  if (!isOwner(profile) && item.id === "marketing-project-folder") notFound();

  return (
    <ResourceDetail
      mode="marketing"
      item={item}
      relatedItems={relatedResourcesFor("marketing", item, sharedItems)}
    />
  );
}
