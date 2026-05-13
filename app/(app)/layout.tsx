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
  const fullBleed = path.startsWith("/atlas");

  return (
    <div className="flex min-h-screen flex-col">
      {impersonating && realProfile && (
        <ImpersonationBanner
          targetEmail={profile.email}
          targetRole={
            profile.role === "loan_officer" ? "LO" : profile.role
          }
        />
      )}
      <div className="flex min-h-screen">
        <Sidebar profile={profile} />
        <div className="flex min-h-screen w-full flex-col">
          <TopBar profile={profile} />
          {fullBleed ? (
            <main className="flex-1 overflow-hidden">{children}</main>
          ) : (
            <main className="flex-1 px-5 py-6">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          )}
        </div>
        <MobileNav profile={profile} />
      </div>
    </div>
  );
}
