import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { MobileNav } from "@/components/shell/MobileNav";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { isSupabaseConfigured } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { getCurrentUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Atlas runs in a full-bleed chat layout (pinned composer + auto-width chat
// area), so we drop the centered max-width wrapper and the page padding only
// on /atlas routes. Everything else still uses the centered shell.
// The pathname is propagated by lib/supabase/middleware.ts via x-pathname.
function pathFromHeaders(): string {
  return headers().get("x-pathname") ?? "";
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { profile, realProfile, impersonating } = await getEffectiveProfile();
  if (!profile) {
    redirect(
      `/login?error=${encodeURIComponent(
        "We could not find a profile for your account. Ask Jeremy to provision you."
      )}`
    );
  }

  const path = pathFromHeaders();
  const fullBleed = path.startsWith("/atlas");

  // For full-bleed routes (Atlas), the whole shell is bounded to the viewport
  // height (h-dvh) with min-h-0 flex children so the chat composer stays pinned
  // and the impersonation banner is accounted for automatically — no page-level
  // scroll just to reach the send box. Every other route keeps the exact prior
  // class strings (min-h-screen + body scroll), so non-Atlas pages are
  // unchanged.
  return (
    <div className={cn("flex flex-col", fullBleed ? "h-dvh overflow-hidden" : "min-h-screen")}>
      {impersonating && realProfile && (
        <ImpersonationBanner
          targetName={profile.full_name ?? profile.email}
          targetEmail={profile.email}
          targetRole={
            profile.role === "loan_officer" ? "LO" : profile.role
          }
        />
      )}
      <div className={cn("flex", fullBleed ? "min-h-0 flex-1" : "min-h-screen")}>
        <Sidebar profile={profile} />
        <div className={cn("flex w-full flex-col", fullBleed ? "min-h-0 flex-1" : "min-h-screen")}>
          <TopBar profile={profile} />
          {fullBleed ? (
            <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          ) : (
            <main className="flex-1 px-4 py-6 sm:px-5 lg:px-6">
              <div className="mx-auto w-full max-w-[1500px]">{children}</div>
            </main>
          )}
        </div>
        <MobileNav profile={profile} />
      </div>
    </div>
  );
}
