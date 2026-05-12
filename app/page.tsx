import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Root() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
