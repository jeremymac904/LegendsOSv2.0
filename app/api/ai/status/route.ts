import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  const env = getServerEnv();
  const providers = [
    {
      id: "openrouter",
      configured: Boolean(env.OPENROUTER_API_KEY),
      env_var: "OPENROUTER_API_KEY",
      default_model: env.OPENROUTER_DEFAULT_MODEL,
    },
    {
      id: "deepseek",
      configured: Boolean(env.DEEPSEEK_API_KEY),
      env_var: "DEEPSEEK_API_KEY",
      default_model: env.DEEPSEEK_DEFAULT_MODEL,
    },
    {
      id: "nvidia",
      configured: Boolean(env.NVIDIA_API_KEY),
      env_var: "NVIDIA_API_KEY",
      default_model: null,
    },
    {
      id: "fal",
      configured: Boolean(env.FAL_KEY),
      env_var: "FAL_KEY",
      default_model: env.FAL_DEFAULT_MODEL,
    },
  ];

  const supabase = getSupabaseServerClient();
  const { data: storedRows } = await supabase
    .from("provider_credentials_public")
    .select("*");

  return NextResponse.json({
    ok: true,
    providers,
    caps: env.DAILY_CAPS,
    safety: env.SAFETY,
    stored: storedRows ?? [],
  });
}
