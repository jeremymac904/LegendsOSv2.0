import { NextResponse } from "next/server";

import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
} from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { ProviderCredentialPublic } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only diagnostics view of every provider. Returns:
//   * provider name (id, label)
//   * configured (env present)
//   * enabled (AI_ENABLE_* flag is not "false")
//   * source ("env" or "missing")
//   * masked_preview ("ab12***wxyz" — never the full key)
//   * updated_at (from the provider_credentials row when present)
//
// NEVER returns full key material. Service-role secrets never leave the server.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Owner-only endpoint.",
      },
      { status: 403 }
    );
  }

  const env = getServerEnv();
  const supabase = getSupabaseServerClient();

  const { data: storedRows } = await supabase
    .from("provider_credentials_public")
    .select("*");
  const stored = (storedRows ?? []) as ProviderCredentialPublic[];
  const storedByProvider = new Map(stored.map((r) => [r.provider, r]));

  const previewLookup: Record<string, string> = {
    openrouter: env.OPENROUTER_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    nvidia: env.NVIDIA_API_KEY,
    fal: env.FAL_KEY,
    huggingface: env.HF_TOKEN,
  };

  const providers = getAIProviderStatuses().map((p) => {
    const stored = storedByProvider.get(p.id);
    const preview = maskedKeyPreview(previewLookup[p.id] ?? "");
    return {
      id: p.id,
      label: p.label,
      configured: p.configured,
      enabled: p.enabled,
      source: p.source,
      env_var_names: p.envVarNames,
      masked_preview: preview || stored?.masked_preview || null,
      updated_at: stored?.updated_at ?? null,
      // Reconcile env state with the stored placeholder row's status field.
      stored_status: stored?.status ?? "missing",
    };
  });

  const automation = [
    {
      id: "n8n",
      label: "n8n",
      configured: Boolean(env.N8N_BASE_URL && env.N8N_WEBHOOK_SECRET),
      enabled: Boolean(env.N8N_BASE_URL),
      source: env.N8N_BASE_URL ? "env" : "missing",
      env_var_names: [
        "N8N_WEBHOOK_BASE_URL",
        "N8N_BASE_URL",
        "N8N_WEBHOOK_SECRET",
      ],
      masked_preview: maskedKeyPreview(env.N8N_WEBHOOK_SECRET) || null,
      updated_at: storedByProvider.get("n8n")?.updated_at ?? null,
      stored_status: storedByProvider.get("n8n")?.status ?? "missing",
    },
  ];

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    providers,
    automation,
    defaults: {
      text_provider: env.AI_DEFAULT_TEXT_PROVIDER,
      image_provider: env.AI_DEFAULT_IMAGE_PROVIDER,
    },
    safety: {
      live_social_publish: env.SAFETY.allowLiveSocialPublish,
      live_email_send: env.SAFETY.allowLiveEmailSend,
    },
  });
}
