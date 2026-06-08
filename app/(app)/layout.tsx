import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { MobileNav } from "@/components/shell/MobileNav";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { isSupabaseConfigured } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { getCurrentUser } from "@/lib/supabase/server";

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
  // Atlas runs full-bleed (its own internal flex column pins the composer).
  // Other chat surfaces (FLO/Coordinator/Marketing) live in the standard padded
  // scroll area but size themselves with h-full, so AgentChat fills the
  // fixed-height main and its composer stays pinned — no page scroll either way.
  const fullBleed = path === "/atlas" || path.startsWith("/atlas/");

  return (
    // App shell = EXACTLY the viewport height (100dvh) and never page-scrolls.
    // All scrolling happens INSIDE the content area (or the chat message list).
    // This is the single fix for "composer below the fold" + "page scroll traps":
    // the shell is fixed-height, so a chat page's h-full resolves to the viewport
    // and its internal flex column pins the composer; non-chat pages scroll within
    // <main> instead of growing the whole document.
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {impersonating && realProfile && (
        <ImpersonationBanner
          targetName={profile.full_name ?? profile.email}
          targetEmail={profile.email}
          targetRole={
            profile.role === "loan_officer" ? "LO" : profile.role
          }
        />
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar profile={profile} />
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar profile={profile} />
          {fullBleed ? (
            <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          ) : (
            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-thin sm:px-5 lg:px-6">
              <div className="mx-auto w-full max-w-[1500px]">{children}</div>
            </main>
          )}
        </div>
        <MobileNav profile={profile} />
      </div>
    </div>
  );
}
