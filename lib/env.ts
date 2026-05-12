// Centralized env access for LegendsOS 2.0.
//
// Goals:
//   * one place to learn whether a provider is configured and enabled
//   * accept both the new Supabase / Fal / HF naming and the legacy names
//   * never expose secrets — only "configured" / "enabled" / masked previews
//   * keep server-only values out of the PUBLIC_ENV bundle that the client
//     can import safely
// ---------------------------------------------------------------------------

function pickFirst(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim() !== "") return v;
  }
  return "";
}

function readBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function read(name: string, opts?: { optional?: boolean; default?: string }): string {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (opts?.default !== undefined) return opts.default;
    if (opts?.optional) return "";
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return raw;
}

// Supabase publishes new API key names (publishable / secret) alongside the
// legacy anon / service_role names. We accept either, preferring the new ones.
const SUPABASE_PUBLISHABLE_KEY = pickFirst(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

// ---------------------------------------------------------------------------
// Public values (safe in browser bundles)
// ---------------------------------------------------------------------------

export const PUBLIC_ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_ANON_KEY: SUPABASE_PUBLISHABLE_KEY,
  OWNER_EMAIL: process.env.NEXT_PUBLIC_OWNER_EMAIL || "jeremy@mcdonald-mtg.com",
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "LegendsOS",
  APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000",
  TEAM_NAME:
    process.env.NEXT_PUBLIC_TEAM_NAME ||
    "The Legends Mortgage Team powered by Loan Factory",
  // The NMLS branding line. Used in Atlas's system prompt and shown in
  // Settings as informational. It is not a "compliance gate".
  BRAND_LINE:
    process.env.NEXT_PUBLIC_BRAND_LINE ||
    process.env.NEXT_PUBLIC_COMPLIANCE_LINE ||
    "Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.",
} as const;

// ---------------------------------------------------------------------------
// AI provider snapshot (server-only)
// ---------------------------------------------------------------------------

export type AIProviderId =
  | "openrouter"
  | "deepseek"
  | "nvidia"
  | "fal"
  | "huggingface";

export interface AIProviderStatus {
  id: AIProviderId;
  label: string;
  envVarNames: string[];
  configured: boolean;
  enabled: boolean;
  source: "env" | "missing";
}

function isEnabled(name: string, defaultOn = true): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultOn;
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

export function getAIProviderStatuses(): AIProviderStatus[] {
  const openrouter = pickFirst("OPENROUTER_API_KEY");
  const deepseek = pickFirst("DEEPSEEK_API_KEY");
  const nvidia = pickFirst("NVIDIA_API_KEY");
  const fal = pickFirst("FAL_KEY", "FAL_API_KEY");
  const huggingface = pickFirst(
    "HF_TOKEN",
    "HUGGINGFACE_API_KEY",
    "HUGGING_FACE_API_KEY"
  );

  return [
    {
      id: "openrouter",
      label: "OpenRouter",
      envVarNames: ["OPENROUTER_API_KEY"],
      configured: openrouter !== "",
      enabled: isEnabled("AI_ENABLE_OPENROUTER"),
      source: openrouter ? "env" : "missing",
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      envVarNames: ["DEEPSEEK_API_KEY"],
      configured: deepseek !== "",
      enabled: isEnabled("AI_ENABLE_DEEPSEEK"),
      source: deepseek ? "env" : "missing",
    },
    {
      id: "nvidia",
      label: "NVIDIA",
      envVarNames: ["NVIDIA_API_KEY"],
      configured: nvidia !== "",
      enabled: isEnabled("AI_ENABLE_NVIDIA"),
      source: nvidia ? "env" : "missing",
    },
    {
      id: "fal",
      label: "Fal.ai",
      envVarNames: ["FAL_KEY", "FAL_API_KEY"],
      configured: fal !== "",
      enabled: isEnabled("AI_ENABLE_FAL"),
      source: fal ? "env" : "missing",
    },
    {
      id: "huggingface",
      label: "Hugging Face",
      envVarNames: ["HF_TOKEN", "HUGGINGFACE_API_KEY"],
      configured: huggingface !== "",
      enabled: isEnabled("AI_ENABLE_HUGGINGFACE"),
      source: huggingface ? "env" : "missing",
    },
  ];
}

// Safe masked preview: first 4 + last 4 chars, never the middle. Returns ""
// if the key isn't set.
export function maskedKeyPreview(value: string): string {
  if (!value) return "";
  if (value.length <= 10) return "***";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Server values (NEVER reference from client components)
// ---------------------------------------------------------------------------

export function getServerEnv() {
  const secretKey = pickFirst("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const falKey = pickFirst("FAL_KEY", "FAL_API_KEY");
  const hfKey = pickFirst("HF_TOKEN", "HUGGINGFACE_API_KEY", "HUGGING_FACE_API_KEY");
  const n8nBaseUrl = pickFirst("N8N_WEBHOOK_BASE_URL", "N8N_BASE_URL");

  return {
    SUPABASE_URL: PUBLIC_ENV.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_ANON_KEY: PUBLIC_ENV.SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: secretKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,

    // Text providers
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    OPENROUTER_BASE_URL:
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    OPENROUTER_DEFAULT_MODEL:
      process.env.OPENROUTER_DEFAULT_MODEL || "anthropic/claude-3.5-sonnet",
    OPENROUTER_FREE_MODELS: [
      process.env.OPENROUTER_FREE_MODEL_1,
      process.env.OPENROUTER_FREE_MODEL_2,
      process.env.OPENROUTER_FREE_MODEL_3,
      process.env.OPENROUTER_FREE_MODEL_4,
    ].filter((m): m is string => Boolean(m && m.trim())),

    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
    DEEPSEEK_BASE_URL:
      process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    DEEPSEEK_DEFAULT_MODEL: process.env.DEEPSEEK_DEFAULT_MODEL || "deepseek-chat",

    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || "",
    NVIDIA_BASE_URL:
      process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    NVIDIA_MODELS: {
      kimi_k2_5: process.env.NVIDIA_MODEL_KIMI_K2_5 || "",
      nemotron_super_120b: process.env.NVIDIA_MODEL_NEMOTRON_SUPER_120B || "",
      mistral_small_4_119b:
        process.env.NVIDIA_MODEL_MISTRAL_SMALL_4_119B_2603 || "",
    },

    // Image provider
    FAL_KEY: falKey,
    FAL_API_KEY: falKey,
    FAL_DEFAULT_MODEL:
      process.env.FAL_DEFAULT_IMAGE_MODEL ||
      process.env.FAL_DEFAULT_MODEL ||
      "fal-ai/flux/schnell",
    FAL_FAST_IMAGE_MODEL: process.env.FAL_FAST_IMAGE_MODEL || "",
    FAL_PREMIUM_IMAGE_MODEL: process.env.FAL_PREMIUM_IMAGE_MODEL || "",

    // Hugging Face
    HF_TOKEN: hfKey,
    HUGGINGFACE_API_KEY: hfKey,
    HUGGINGFACE_DEFAULT_MODEL: process.env.HUGGINGFACE_DEFAULT_MODEL || "",

    // Default routing preferences
    AI_DEFAULT_TEXT_PROVIDER:
      (process.env.AI_DEFAULT_TEXT_PROVIDER as AIProviderId) || "openrouter",
    AI_DEFAULT_IMAGE_PROVIDER:
      (process.env.AI_DEFAULT_IMAGE_PROVIDER as AIProviderId) || "fal",

    // n8n
    N8N_BASE_URL: n8nBaseUrl,
    N8N_WEBHOOK_BASE_URL: n8nBaseUrl,
    N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET || "",
    N8N_API_KEY: process.env.N8N_API_KEY || "",
    N8N_WEBHOOKS: {
      social_publish: process.env.N8N_WEBHOOK_SOCIAL_PUBLISH || "",
      gbp_post: process.env.N8N_WEBHOOK_GBP_POST || "",
      facebook_post: process.env.N8N_WEBHOOK_FACEBOOK_POST || "",
      instagram_post: process.env.N8N_WEBHOOK_INSTAGRAM_POST || "",
      youtube_post: process.env.N8N_WEBHOOK_YOUTUBE_POST || "",
      email_send: process.env.N8N_WEBHOOK_EMAIL_SEND || "",
      daily_usage: process.env.N8N_WEBHOOK_DAILY_USAGE || "",
      provider_health: process.env.N8N_WEBHOOK_PROVIDER_HEALTH || "",
      content_reminder: process.env.N8N_WEBHOOK_CONTENT_REMINDER || "",
      failed_publish_recovery: process.env.N8N_WEBHOOK_FAILED_PUBLISH_RECOVERY || "",
    },

    DAILY_CAPS: {
      chat: readNumber("DAILY_CAP_CHAT_MESSAGES", 100),
      images: readNumber("DAILY_CAP_IMAGE_GENERATIONS", 10),
      social: readNumber("DAILY_CAP_SOCIAL_POSTS", 50),
      email: readNumber("DAILY_CAP_EMAIL_DRAFTS", 25),
    },

    SAFETY: {
      // Owner-controlled external-action toggles. The UI never calls these
      // "approval gates" or "compliance gates" — they are simply on/off
      // toggles for whether outbound publishing / sending may actually run.
      allowLiveSocialPublish: readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false),
      allowLiveEmailSend: readBool("ALLOW_LIVE_EMAIL_SEND", false),
    },
  } as const;
}

export { read };

export function isSupabaseConfigured(): boolean {
  return Boolean(PUBLIC_ENV.SUPABASE_URL && PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY);
}

// Helper used in multiple places to decide whether a text provider call may
// run. Configured + enabled is sufficient — no separate "paid" gate.
export function canCallTextProvider(id: AIProviderId): {
  ok: boolean;
  reason?: string;
  envVar?: string;
} {
  const statuses = getAIProviderStatuses();
  const s = statuses.find((x) => x.id === id);
  if (!s) return { ok: false, reason: "unknown_provider" };
  if (!s.configured) {
    return {
      ok: false,
      reason: "provider_not_configured",
      envVar: s.envVarNames[0],
    };
  }
  if (!s.enabled) {
    return {
      ok: false,
      reason: "provider_disabled_by_owner",
      envVar: `AI_ENABLE_${id.toUpperCase()}`,
    };
  }
  return { ok: true };
}

export function canCallImageProvider(): {
  ok: boolean;
  reason?: string;
  envVar?: string;
} {
  const statuses = getAIProviderStatuses();
  const fal = statuses.find((x) => x.id === "fal");
  if (!fal?.configured) {
    return { ok: false, reason: "provider_not_configured", envVar: "FAL_KEY" };
  }
  if (!fal.enabled) {
    return {
      ok: false,
      reason: "provider_disabled_by_owner",
      envVar: "AI_ENABLE_FAL",
    };
  }
  return { ok: true };
}
