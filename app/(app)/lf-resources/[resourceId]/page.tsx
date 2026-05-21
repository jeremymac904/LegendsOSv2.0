import { notFound } from "next/navigation";

import { ResourceDetail } from "@/components/resources/ResourceDetail";
import { getEffectiveProfile } from "@/lib/impersonation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  LF_RESOURCE_TYPE,
  findTeamResource,
  relatedResourcesFor,
  resourceFromShared,
} from "@/lib/teamResources";
import type { SharedResource } from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { resourceId: string };
}

export default async function LFResourceDetailPage({ params }: PageProps) {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("shared_resources")
    .select("*")
    .eq("resource_type", LF_RESOURCE_TYPE)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const sharedItems = ((data ?? []) as SharedResource[]).map(resourceFromShared);
  const item = findTeamResource("lf", params.resourceId, sharedItems);
  if (!item) notFound();

  return (
    <ResourceDetail
      mode="lf"
      item={item}
      relatedItems={relatedResourcesFor("lf", item, sharedItems)}
    />
  );
}
