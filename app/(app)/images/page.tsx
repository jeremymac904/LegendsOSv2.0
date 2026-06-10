import Link from "next/link";
import { ImageIcon, ImagePlus } from "lucide-react";

import { GeneratedMediaCard } from "@/components/images/GeneratedMediaCard";
import {
  AssetLibraryBrowser,
  type AssetLibraryItem,
} from "@/components/images/AssetLibraryBrowser";
import {
  ImageStudioClient,
  type FalReadiness,
  type ReferenceAsset,
} from "@/components/images/ImageStudioClient";
import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { imageLibrary } from "@/lib/assets";
import { loadOrgUploadedImageAssets } from "@/lib/admin/orgAssets";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { GeneratedMedia } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ImageStudioPage() {
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
  const env = getServerEnv();

  const [{ data }, uploadedImages, { data: falProviderRow }] = await Promise.all([
    supabase
      .from("generated_media")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    loadOrgUploadedImageAssets(),
    supabase
      .from("provider_credentials_public")
      .select("provider,is_enabled")
      .eq("provider", "fal")
      .maybeSingle(),
  ]);
  const media = (data ?? []) as GeneratedMedia[];

  const falStatus = getAIProviderStatuses().find((p) => p.id === "fal");
  const falConfigured = Boolean(env.FAL_KEY);
  const falOwnerEnabled = falProviderRow?.is_enabled !== false;
  const falEnabled = Boolean(falStatus?.enabled && falOwnerEnabled);

  const falReadiness: FalReadiness = !falConfigured
    ? "not_configured"
    : falEnabled
    ? "ready"
    : "provider_disabled";

  const owner = isOwner(profile);
  const manifestRefs = imageLibrary().filter(
    (a) => owner || a.default_visibility === "team_shared"
  );
  const uploadedRefs = uploadedImages.filter(
    (a) => owner || a.default_visibility === "team_shared"
  );
  const assetRefs = [...uploadedRefs, ...manifestRefs];

  const composerReferenceAssets: ReferenceAsset[] = assetRefs
    .filter((a) => a.public_path)
    .map((a) => ({
      id: a.id,
      label: a.label,
      public_path: a.public_path,
      source: uploadedRefs.some((u) => u.id === a.id) ? "uploaded" : "library",
    }));

  const starters = assetRefs
    .filter(
      (a) =>
        a.public_path &&
        (a.category === "social_image" ||
          a.category === "image_studio_reference" ||
          a.category === "background")
    )
    .slice(0, 6);

  const uploadedIds = new Set(uploadedRefs.map((u) => u.id));
  const starterIds = new Set(starters.map((s) => s.id));
  const browserAssets: AssetLibraryItem[] = assetRefs
    .filter((a) => a.public_path)
    .map((a) => ({
      id: a.id,
      label: a.label,
      file_name: a.file_name,
      category: a.category,
      public_path: a.public_path,
      origin: uploadedIds.has(a.id)
        ? "uploaded"
        : starterIds.has(a.id)
        ? "sample"
        : "library",
    }));

  const readinessChip =
    falReadiness === "ready" ? (
      <span className="chip-ok text-[10px]">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-status-ok" />
        FAL READY
      </span>
    ) : (
      <span className="chip-warn text-[10px]">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-accent-gold" />
        FAL {falReadiness === "not_configured" ? "UNCONFIGURED" : "DISABLED"}
      </span>
    );

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[650px] flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          eyebrow="Image Studio"
          title="Marketing Visuals"
          description="Brand-aware generation via Fal.ai."
        />
        <div className="flex items-center gap-2">
           {readinessChip}
           <LegendsOSHelpCoaches coaches={["marketing"]} />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[320px_1fr]">
        <div className="overflow-y-auto pr-1 scrollbar-thin">
           <ImageStudioClient
             falReadiness={falReadiness}
             referenceAssets={composerReferenceAssets}
           />
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white/40 dark:border-ink-800 dark:bg-ink-950/20">
           <ImageStudioGalleryTabs
              media={media}
              browserAssets={browserAssets}
              starters={starters}
              owner={owner}
              falConfigured={falConfigured}
           />
        </div>
      </div>
    </div>
  );
}

import { Tabs, type TabItem } from "@/components/ui/Tabs";

function ImageStudioGalleryTabs({ media, browserAssets, starters, owner, falConfigured }: any) {
  const tabs: TabItem[] = [
    {
      id: "generated",
      label: `Generated (${media.length})`,
      icon: ImageIcon,
      content: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
           {media.length === 0 ? (
             <div className="col-span-full py-20">
                <EmptyState icon={ImageIcon} title="No generations" description={falConfigured ? "Run a prompt to see results." : "Setup FAL_KEY first."} />
             </div>
           ) : (
             media.map((m: any) => <GeneratedMediaCard key={m.id} media={m} />)
           )}
        </div>
      )
    },
    {
      id: "brand",
      label: "Brand Library",
      icon: ImagePlus,
      content: (
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <p className="text-[11px] text-ink-500">Pick references for generation or browse team assets.</p>
              {owner && <Link href="/admin/assets" className="text-[10px] text-accent-gold hover:underline">Manage Library →</Link>}
           </div>
           <AssetLibraryBrowser assets={browserAssets} />
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
       <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <Tabs tabs={tabs} variant="pill" />
       </div>
    </div>
  );
}
