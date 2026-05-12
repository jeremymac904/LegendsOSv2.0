// Centralized env access. Throws clearly when something required is missing
// at server boot. Browser-facing values use NEXT_PUBLIC_ prefix.

function read(name: string, opts?: { optional?: boolean; default?: string }): string {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (opts?.default !== undefined) return opts.default;
    if (opts?.optional) return "";
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return raw;
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

// Public values (safe in browser bundles) -----------------------------------
export const PUBLIC_ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  OWNER_EMAIL: process.env.NEXT_PUBLIC_OWNER_EMAIL || "jeremy@mcdonald-mtg.com",
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "LegendsOS",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  TEAM_NAME:
    process.env.NEXT_PUBLIC_TEAM_NAME ||
    "The Legends Mortgage Team powered by Loan Factory",
  COMPLIANCE_LINE:
    process.env.NEXT_PUBLIC_COMPLIANCE_LINE ||
    "Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.",
} as const;

// Server values (NEVER reference these in client components) -----------------
export function getServerEnv() {
  return {
    SUPABASE_URL: PUBLIC_ENV.SUPABASE_URL,
    SUPABASE_ANON_KEY: PUBLIC_ENV.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: read("SUPABASE_SERVICE_ROLE_KEY", { optional: true }),
    OPENROUTER_API_KEY: read("OPENROUTER_API_KEY", { optional: true }),
    OPENROUTER_DEFAULT_MODEL: read("OPENROUTER_DEFAULT_MODEL", {
      default: "anthropic/claude-3.5-sonnet",
    }),
    DEEPSEEK_API_KEY: read("DEEPSEEK_API_KEY", { optional: true }),
    DEEPSEEK_DEFAULT_MODEL: read("DEEPSEEK_DEFAULT_MODEL", {
      default: "deepseek-chat",
    }),
    NVIDIA_API_KEY: read("NVIDIA_API_KEY", { optional: true }),
    FAL_KEY: read("FAL_KEY", { optional: true }),
    FAL_DEFAULT_MODEL: read("FAL_DEFAULT_MODEL", {
      default: "fal-ai/flux/schnell",
    }),
    N8N_BASE_URL: read("N8N_BASE_URL", { optional: true }),
    N8N_WEBHOOK_SECRET: read("N8N_WEBHOOK_SECRET", { optional: true }),
    N8N_WEBHOOKS: {
      social_publish: read("N8N_WEBHOOK_SOCIAL_PUBLISH", { optional: true }),
      gbp_post: read("N8N_WEBHOOK_GBP_POST", { optional: true }),
      facebook_post: read("N8N_WEBHOOK_FACEBOOK_POST", { optional: true }),
      instagram_post: read("N8N_WEBHOOK_INSTAGRAM_POST", { optional: true }),
      youtube_post: read("N8N_WEBHOOK_YOUTUBE_POST", { optional: true }),
      email_send: read("N8N_WEBHOOK_EMAIL_SEND", { optional: true }),
      daily_usage: read("N8N_WEBHOOK_DAILY_USAGE", { optional: true }),
      provider_health: read("N8N_WEBHOOK_PROVIDER_HEALTH", { optional: true }),
      content_reminder: read("N8N_WEBHOOK_CONTENT_REMINDER", { optional: true }),
      failed_publish_recovery: read("N8N_WEBHOOK_FAILED_PUBLISH_RECOVERY", {
        optional: true,
      }),
    },
    DAILY_CAPS: {
      chat: readNumber("DAILY_CAP_CHAT_MESSAGES", 100),
      images: readNumber("DAILY_CAP_IMAGE_GENERATIONS", 10),
      social: readNumber("DAILY_CAP_SOCIAL_POSTS", 50),
      email: readNumber("DAILY_CAP_EMAIL_DRAFTS", 25),
    },
    SAFETY: {
      allowLiveSocialPublish: readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false),
      allowLiveEmailSend: readBool("ALLOW_LIVE_EMAIL_SEND", false),
      allowPaidImageGeneration: readBool("ALLOW_PAID_IMAGE_GENERATION", false),
      allowPaidTextGeneration: readBool("ALLOW_PAID_TEXT_GENERATION", false),
    },
  } as const;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(PUBLIC_ENV.SUPABASE_URL && PUBLIC_ENV.SUPABASE_ANON_KEY);
}
