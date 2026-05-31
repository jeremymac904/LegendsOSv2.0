import { redirect } from "next/navigation";

import { BuilderWorkspace } from "@/components/builder/BuilderWorkspace";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Owner-only at the PAGE level — mirrors the enforcement used in
// app/(app)/admin/page.tsx. Hiding the nav item is not enough; a
// non-owner who types /builder directly is redirected to /dashboard.
export default async function BuilderPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  return <BuilderWorkspace ownerName={profile.full_name ?? profile.email ?? "Owner"} />;
}
