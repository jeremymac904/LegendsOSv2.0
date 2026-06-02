import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentSession } from "@/lib/supabase/server";
import { resolveWorkspaceBranding } from "@/lib/themeServer";

export const dynamic = "force-dynamic";

export default async function Root() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }
  const host = headers().get("x-hostname") ?? headers().get("host");
  const branding = await resolveWorkspaceBranding(host);
  const session = await getCurrentSession();
  if (session) {
    redirect(branding.defaultRedirectPath ?? "/dashboard");
  }
  redirect("/login");
}
