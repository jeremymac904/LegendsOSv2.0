import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
} from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
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
    // A provider is considered enabled when BOTH the env flag is not
    // disabled AND the stored is_enabled flag (default true) is true.
    const ownerToggleOn = stored?.is_enabled !== false;
    return {
      id: p.id,
      label: p.label,
      configured: p.configured,
      enabled: p.enabled && ownerToggleOn,
      env_enabled: p.enabled,
      owner_toggle_on: ownerToggleOn,
      source: p.source,
      env_var_names: p.envVarNames,
      masked_preview: preview || stored?.masked_preview || null,
      updated_at: stored?.updated_at ?? null,
      stored_status: stored?.status ?? "missing",
    };
  });

  // n8n is "configured" when we have at least the base URL AND at least one
  // active webhook path. HMAC signing was removed — the simplified workflows
  // accept plain JSON.
  const activeWebhooks = Object.entries(env.N8N_WEBHOOKS).filter(
    ([, url]) => Boolean(url)
  );
  const automation = [
    {
      id: "n8n",
      label: "n8n",
      configured: Boolean(env.N8N_BASE_URL && activeWebhooks.length > 0),
      enabled: Boolean(env.N8N_BASE_URL),
      source: env.N8N_BASE_URL ? "env" : "missing",
      env_var_names: [
        "N8N_WEBHOOK_BASE_URL",
        "N8N_WEBHOOK_SOCIAL_PUBLISH",
        "N8N_WEBHOOK_EMAIL_SEND",
        "N8N_WEBHOOK_DAILY_USAGE",
        "N8N_WEBHOOK_PROVIDER_HEALTH",
        "N8N_WEBHOOK_CONTENT_REMINDER",
        "N8N_WEBHOOK_FAILED_PUBLISH_RECOVERY",
      ],
      masked_preview: null,
      active_webhook_count: activeWebhooks.length,
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

// PATCH /api/admin/providers
// Body: { provider: "openrouter" | "deepseek" | ..., enabled: boolean }
//
// Toggles `provider_credentials.is_enabled` for the current org's row. Only
// the owner role may call this. Never accepts or returns key material.
const patchSchema = z.object({
  provider: z.string().min(1).max(64),
  enabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner-only endpoint." },
      { status: 403 }
    );
  }
  if (!profile.organization_id) {
    return NextResponse.json(
      { ok: false, error: "no_org", message: "Owner is not linked to an organization." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }
  const { provider, enabled } = parsed.data;

  // Upsert by (organization_id, provider). The bootstrap migration seeds
  // rows for the standard providers, but we upsert defensively so the
  // toggle works even if a row is missing.
  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from("provider_credentials")
    .upsert(
      {
        organization_id: profile.organization_id,
        provider,
        is_enabled: enabled,
        // Don't touch status / encrypted_secret here.
      },
      { onConflict: "organization_id,provider" }
    )
    .select("id,provider,is_enabled,updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: error?.message ?? "update failed" },
      { status: 500 }
    );
  }

  await recordAudit({
    actor: profile,
    action: enabled ? "provider_enabled" : "provider_disabled",
    target_type: "provider_credentials",
    target_id: data.id,
    metadata: { provider },
  });

  return NextResponse.json({
    ok: true,
    provider: data.provider,
    is_enabled: data.is_enabled,
    updated_at: data.updated_at,
  });
}
