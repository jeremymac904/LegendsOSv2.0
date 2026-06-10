import Link from "next/link";
import { Settings2 } from "lucide-react";

import { CompanionClient } from "@/components/companion/CompanionClient";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PUBLIC_ENV } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// /browser-companion — the in-app surface for the Chrome companion.
//
// Auth is enforced by the (app) layout (redirects to /login when there is no
// session/profile), but we still resolve the effective profile here so we can
// pass the user's role down to the client for role-aware assistant routing and
// render nothing rather than leak a shell if the profile is somehow absent.
export default async function BrowserCompanionPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Browser Companion"
        title="Capture portal context into Atlas"
        description="The Chrome companion captures safe, non-sensitive context from your loan portal (page URL, title, and text you select) and routes it to the right assistant. It signs in with your existing LegendsOS session — no tokens are stored in the extension."
        action={
          <Link href="/browser-companion/setup" className="btn-ghost text-xs">
            <Settings2 size={13} />
            Setup &amp; pairing
          </Link>
        }
      />

      <CompanionClient
        role={profile.role}
        appName={PUBLIC_ENV.APP_NAME}
        baseUrl={PUBLIC_ENV.APP_URL}
      />
    </div>
  );
}
