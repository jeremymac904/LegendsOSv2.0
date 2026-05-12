import { NextResponse } from "next/server";

import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
} from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public-safe provider status. Everyone authenticated can call this — it's
// what powers the chips in Atlas / Settings / Image Studio. It never returns
// key material.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  const env = getServerEnv();
  const providers = getAIProviderStatuses().map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.configured,
    enabled: p.enabled,
    source: p.source,
    env_var_names: p.envVarNames,
  }));

  return NextResponse.json({
    ok: true,
    providers,
    defaults: {
      text_provider: env.AI_DEFAULT_TEXT_PROVIDER,
      image_provider: env.AI_DEFAULT_IMAGE_PROVIDER,
      openrouter_default_model: env.OPENROUTER_DEFAULT_MODEL,
      deepseek_default_model: env.DEEPSEEK_DEFAULT_MODEL,
      fal_default_model: env.FAL_DEFAULT_MODEL,
    },
    models: {
      openrouter_free: env.OPENROUTER_FREE_MODELS,
      nvidia: {
        kimi_k2_5: env.NVIDIA_MODELS.kimi_k2_5 || null,
        nemotron_super_120b: env.NVIDIA_MODELS.nemotron_super_120b || null,
        mistral_small_4_119b: env.NVIDIA_MODELS.mistral_small_4_119b || null,
      },
      fal: {
        fast: env.FAL_FAST_IMAGE_MODEL || null,
        premium: env.FAL_PREMIUM_IMAGE_MODEL || null,
      },
    },
    caps: env.DAILY_CAPS,
    safety: {
      // External-action toggles. Used to render "External sending disabled"
      // labels in Social / Email Studio. Not a compliance gate.
      live_social_publish: env.SAFETY.allowLiveSocialPublish,
      live_email_send: env.SAFETY.allowLiveEmailSend,
    },
    automation: {
      n8n_configured: Boolean(
        env.N8N_BASE_URL &&
          Object.values(env.N8N_WEBHOOKS).some((u) => Boolean(u))
      ),
    },
    // Masked previews only — never the full key. Even though only authenticated
    // users hit this endpoint, providing masked-only is defense in depth.
    previews: {
      openrouter: maskedKeyPreview(env.OPENROUTER_API_KEY),
      deepseek: maskedKeyPreview(env.DEEPSEEK_API_KEY),
      nvidia: maskedKeyPreview(env.NVIDIA_API_KEY),
      fal: maskedKeyPreview(env.FAL_KEY),
      huggingface: maskedKeyPreview(env.HF_TOKEN),
    },
  });
}
