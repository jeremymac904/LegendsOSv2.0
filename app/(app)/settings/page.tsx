import Link from "next/link";
import {
  Cpu,
  HardDrive,
  Plug,
  Sparkles,
  UserCircle,
  Video,
} from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { DriveLoanBrainSetup } from "@/components/settings/DriveLoanBrainSetup";
import { ProviderToggle } from "@/components/settings/ProviderToggle";
import { MCPConnections } from "@/components/settings/MCPConnections";
import {
  SettingsConnectionSetup,
  type ConnectionSetupGuide,
} from "@/components/settings/SettingsConnectionSetup";
import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
  PUBLIC_ENV,
} from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { ProviderCredentialPublic } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;

  // HARDENING: getServerEnv()/getAIProviderStatuses() read process.env and can
  // throw if a required var is missing on a fresh deploy. Settings must never
  // crash — fall back to a safe empty env snapshot so the page still renders.
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    env = getSafeEnvFallback();
  }

  // HARDENING: the provider table may not exist yet (e.g.
  // provider_credentials_public missing) or the supabase client may fail to
  // construct when env is absent. Guard both the client creation and the query
  // so a missing table/env returns [] instead of throwing.
  let providerRows: ProviderCredentialPublic[] | null = null;
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("provider_credentials_public")
      .select("*")
      .order("provider");
    providerRows = (data ?? []) as ProviderCredentialPublic[];
  } catch {
    // Table missing, RLS rejection, or unconfigured supabase — degrade to no
    // stored placeholders. Live env detection below still drives the gateway.
    providerRows = [];
  }

  const owner = isOwner(profile);
  const storedProviders = (providerRows ?? []) as ProviderCredentialPublic[];
  // HARDENING: provider status derivation reads env flags; guard so a bad env
  // can't take the whole page down.
  let liveStatuses: ReturnType<typeof getAIProviderStatuses>;
  try {
    liveStatuses = getAIProviderStatuses();
  } catch {
    liveStatuses = [];
  }
  const storedByProvider = new Map(storedProviders.map((r) => [r.provider, r]));
  const previewLookup: Record<string, string> = {
    openrouter: env.OPENROUTER_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    nvidia: env.NVIDIA_API_KEY,
    minimax: env.MINIMAX_API_KEY,
    fal: env.FAL_KEY,
    huggingface: env.HF_TOKEN,
  };
  // Merge live env detection with the stored placeholder row (for last-updated
  // timestamp and the env var name).
  const merged = liveStatuses.map((s) => {
    const stored = storedByProvider.get(s.id);
    // Owner-controlled toggle is stored on provider_credentials.is_enabled.
    // Default to enabled when there is no row yet (most common pre-import
    // state). The Atlas gateway respects this flag at runtime.
    const ownerToggleOn = stored?.is_enabled !== false;
    return {
      ...s,
      preview: maskedKeyPreview(previewLookup[s.id] ?? "") || stored?.masked_preview || "",
      updated_at: stored?.updated_at ?? null,
      ownerToggleOn,
      // The "is this provider actually usable right now" decision combines
      // the env flag and the owner toggle.
      effectiveEnabled: s.enabled && ownerToggleOn,
    };
  });

  const externalToggles = [
    {
      label: "External social publishing",
      on: env.SAFETY.allowLiveSocialPublish,
      env_var: "ALLOW_LIVE_SOCIAL_PUBLISH",
    },
    {
      label: "External email sending",
      on: env.SAFETY.allowLiveEmailSend,
      env_var: "ALLOW_LIVE_EMAIL_SEND",
    },
  ];
  const modelLookup: Record<string, string[]> = {
    openrouter: [env.OPENROUTER_DEFAULT_MODEL, ...env.OPENROUTER_FREE_MODELS].filter(Boolean),
    deepseek: [env.DEEPSEEK_DEFAULT_MODEL].filter(Boolean),
    nvidia: Object.values(env.NVIDIA_MODELS).filter(Boolean),
    minimax: [env.MINIMAX_DEFAULT_MODEL, ...env.MINIMAX_MODELS].filter(Boolean),
    fal: [
      env.FAL_DEFAULT_MODEL,
      env.FAL_FAST_IMAGE_MODEL,
      env.FAL_PREMIUM_IMAGE_MODEL,
    ].filter(Boolean),
    huggingface: [env.HUGGINGFACE_DEFAULT_MODEL].filter(Boolean),
  };
  const n8nWebhookCount = Object.values(env.N8N_WEBHOOKS).filter(Boolean).length;
  const connectionGuides: ConnectionSetupGuide[] = [
    {
      id: "n8n",
      title: "n8n workflow broker",
      detail: `${n8nWebhookCount} webhook${n8nWebhookCount === 1 ? "" : "s"} configured`,
      envNames: ["N8N_BASE_URL", "N8N_WEBHOOK_*"],
      configured: Boolean(env.N8N_BASE_URL || n8nWebhookCount > 0),
      icon: "plug",
      scope: "Owner",
      href: "/admin",
      buttonLabel: "Open Admin Center",
      steps: [
        "Create or confirm the n8n workflow in the broker workspace.",
        "Set the n8n base URL and required webhook names in the hosting environment.",
        "Keep live actions disabled until the owner flags and workflow tests are ready.",
      ],
      ownerAction:
        "Review webhook status, run sandbox tests, and keep publishing/sending flags off until approved.",
      teamAction:
        "Use Studio draft and schedule flows. Do not publish live unless Jeremy has enabled the safe path.",
      videoPlaceholder: "n8n broker setup walkthrough",
    },
    {
      id: "heygen",
      title: "HeyGen welcome video",
      detail: process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL
        ? "Login welcome video URL present"
        : "Embed URL missing",
      envNames: ["NEXT_PUBLIC_WELCOME_VIDEO_URL"],
      configured: Boolean(process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL),
      icon: "video",
      scope: "Owner",
      href: "/login",
      buttonLabel: "View Login",
      steps: [
        "Create or approve the welcome video in HeyGen.",
        "Use the safe embed URL, not raw iframe HTML.",
        "Set the public welcome video URL and verify the login page render.",
      ],
      ownerAction: "Update the embed URL only through environment configuration.",
      teamAction: "Loan officers can watch the login welcome video before signing in.",
      videoPlaceholder: "HeyGen welcome video setup",
    },
    {
      id: "google-oauth",
      title: "Google, Gmail, Calendar",
      detail:
        process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
          ? "OAuth client present"
          : "OAuth client missing",
      envNames: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
      configured: Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ),
      icon: "google",
      scope: "Team",
      href: "/calendar",
      buttonLabel: "Open Calendar",
      steps: [
        "Create or confirm the Google OAuth client for the LegendsOS app.",
        "Add the authorized redirect URL used by the app.",
        "Enable Gmail, Calendar, and Drive scopes only where the app supports them.",
        "Use the Connect with Google path when it is available in the relevant module.",
      ],
      ownerAction:
        "Configure OAuth client credentials in the deployment environment. Saved values are never shown in the browser.",
      teamAction:
        "Use supported Google connection buttons when they appear. If not available, follow the setup coach instructions.",
      videoPlaceholder: "Google Workspace connection walkthrough",
    },
    {
      id: "google-drive",
      title: "Google Drive",
      detail:
        process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
          ? "OAuth client present"
          : "OAuth client missing",
      envNames: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
      configured: Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ),
      icon: "google",
      scope: "Team",
      href: "/knowledge",
      buttonLabel: "Open Knowledge",
      steps: [
        "Confirm OAuth is configured.",
        "Use Knowledge Sources for files that Atlas should retrieve.",
        "Use LF Resources and Training for user-facing Drive folders and videos.",
      ],
      ownerAction: "Add approved Drive source folders as resource cards or knowledge sources.",
      teamAction: "Upload allowed docs through Knowledge or open approved LF Resource source links.",
      videoPlaceholder: "Google Drive knowledge and resources walkthrough",
    },
    {
      id: "social-platforms",
      title: "Meta, YouTube, GBP",
      detail: "Social publishing stays draft-only until webhooks and owner flags are on",
      envNames: [
        "N8N_WEBHOOK_FACEBOOK_POST",
        "N8N_WEBHOOK_INSTAGRAM_POST",
        "N8N_WEBHOOK_YOUTUBE_POST",
        "N8N_WEBHOOK_GBP_POST",
      ],
      configured: Boolean(
        env.N8N_WEBHOOKS.facebook_post ||
          env.N8N_WEBHOOKS.instagram_post ||
          env.N8N_WEBHOOKS.youtube_post ||
          env.N8N_WEBHOOKS.gbp_post
      ),
      icon: "plug",
      scope: "Owner",
      href: "/social",
      buttonLabel: "Open Social Studio",
      steps: [
        "Connect approved social accounts in the external platform or n8n workflow.",
        "Set the platform webhook names only after the workflow is tested.",
        "Keep live posting disabled unless Jeremy enables the owner flag.",
      ],
      ownerAction:
        "Use draft previews and sandbox workflow tests before enabling any external publish path.",
      teamAction: "Create and save drafts. Live social publishing remains disabled unless configured.",
      videoPlaceholder: "Social connector setup walkthrough",
    },
    {
      id: "zapier-mcp",
      title: "Zapier MCP",
      detail: "Personal or team MCP endpoints can be saved below",
      envNames: ["Zapier MCP URL", "Zapier MCP token"],
      configured: true,
      icon: "plug",
      scope: "Personal",
      href: "#mcp-connections",
      buttonLabel: "Open MCP Connections",
      steps: [
        "Create the MCP endpoint in Zapier.",
        "Save the endpoint URL and token in the MCP Connections panel.",
        "Test with Atlas before relying on it for workflow tasks.",
      ],
      ownerAction: "Use team scoped MCP only for shared workflows.",
      teamAction: "Use personal MCP for personal connector actions and keep tokens private.",
      videoPlaceholder: "Zapier MCP setup walkthrough",
    },
    {
      id: "telegram",
      title: "Telegram bot actions",
      detail: process.env.TELEGRAM_BOT_TOKEN
        ? "Bot token present"
        : "Bot token missing",
      envNames: ["TELEGRAM_BOT_TOKEN"],
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      icon: "bot",
      scope: "Owner",
      href: "/atlas",
      buttonLabel: "Open Atlas",
      steps: [
        "Create or confirm the Telegram bot with the approved account.",
        "Set the bot token in the server environment.",
        "Route Telegram actions through Atlas or n8n only after testing.",
      ],
      ownerAction: "Store the bot token server-side only. Never paste saved secrets into the browser.",
      teamAction: "Use Atlas prompts that call configured tools; do not share bot tokens.",
      videoPlaceholder: "Telegram bot action setup walkthrough",
    },
    {
      id: "mcp-apps",
      title: "MCP app connections",
      detail: "User-managed endpoints live below this panel",
      envNames: ["MCP URL", "MCP token"],
      configured: true,
      icon: "mail",
      scope: "Personal",
      href: "#mcp-connections",
      buttonLabel: "Open MCP Connections",
      steps: [
        "Choose whether the connection is personal or team scoped.",
        "Save the endpoint and token in the MCP Connections panel.",
        "Ask Atlas what connected tools are available after saving.",
      ],
      ownerAction: "Keep team endpoints limited to shared workflows.",
      teamAction: "Use personal endpoints for user-owned connector actions.",
      videoPlaceholder: "Personal MCP setup walkthrough",
    },
    {
      id: "ai-providers",
      title: "AI subscriptions",
      detail: `${merged.filter((p) => p.configured).length} provider${merged.filter((p) => p.configured).length === 1 ? "" : "s"} configured`,
      envNames: [
        "OPENROUTER_API_KEY",
        "FAL_KEY",
        "HF_TOKEN",
        "DEEPSEEK_API_KEY",
        "NVIDIA_API_KEY",
        "MINIMAX_API_KEY",
      ],
      configured: merged.some((p) => p.configured),
      icon: "key",
      scope: "Owner",
      href: "#ai-provider-gateway",
      buttonLabel: "Open Provider Gateway",
      steps: [
        "Choose the provider and model lane needed by Atlas or Image Studio.",
        "Set provider keys only in secure server environment variables.",
        "Use masked previews and provider status to confirm readiness.",
        "Use the owner toggle to disable a provider without exposing or deleting keys.",
      ],
      ownerAction:
        "Add provider keys in Netlify or the secure host environment. MiniMax is included as a supported provider lane.",
      teamAction: "Use enabled providers through Atlas and Studios. Provider keys are never shown to users.",
      videoPlaceholder: "AI provider gateway setup walkthrough",
    },
  ];

  // Sections are grouped into a collapsible Accordion to cut scrolling. The
  // Profile + External actions row stays pinned above as the primary glance.
  const sections: AccordionItemData[] = [
    {
      id: "connections",
      title: "Connections & setup coaches",
      meta: `${connectionGuides.filter((g) => g.configured).length}/${connectionGuides.length} configured`,
      icon: Plug,
      defaultOpen: true,
      children: <SettingsConnectionSetup guides={connectionGuides} />,
    },
    {
      id: "drive-loan-brain",
      title: "Drive & Loan Brain",
      icon: HardDrive,
      children: <DriveLoanBrainSetup />,
    },
    {
      id: "tutorials",
      title: "Setup tutorials",
      icon: Video,
      children: (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Owner broker setup", "n8n, provider keys, live action flags"],
            ["Team connector setup", "MCP, Google, Gmail, Calendar, Drive"],
            ["Personal workspace setup", "Per-user providers and project knowledge"],
          ].map(([title, detail]) => (
            <div
              key={title}
              className="overflow-hidden rounded-xl border border-accent-champagne/10 bg-ink-950/30 backdrop-blur-sm"
            >
              <div className="grid aspect-video place-items-center border-b border-accent-champagne/10 bg-ink-950/50">
                <Video size={22} className="text-accent-champagne/80" />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-ink-100">{title}</p>
                <p className="mt-1 text-xs text-ink-300">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "ai-providers",
      title: "AI Provider Gateway",
      meta: `${merged.filter((p) => p.configured).length} connected`,
      icon: Cpu,
      defaultOpen: true,
      children: (
        <div id="ai-provider-gateway" className="scroll-mt-24">
          <div className="section-title">
            <div>
              <h2>AI Provider Gateway</h2>
              <p>
                Server-side credential status detected from environment variables.
                Secrets never leave the server — only masked previews shown below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-300">
              <span className="uppercase tracking-[0.18em] text-[10px]">
                Atlas default:
              </span>
              <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-accent-gold">
                {env.AI_DEFAULT_TEXT_PROVIDER || "openrouter"}
              </span>
              <span className="text-ink-400">·</span>
              <span className="uppercase tracking-[0.18em] text-[10px]">
                Image:
              </span>
              <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-accent-gold">
                {env.AI_DEFAULT_IMAGE_PROVIDER || "fal"}
              </span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-accent-champagne/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-950/50 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                <tr>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Env var(s)</th>
                  <th className="px-3 py-2">Masked preview</th>
                  <th className="px-3 py-2">Models</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Test</th>
                  <th className="px-3 py-2 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody>
                {merged.map((p) => {
                  const isTextDefault =
                    p.id === env.AI_DEFAULT_TEXT_PROVIDER &&
                    ["openrouter", "deepseek", "nvidia"].includes(p.id);
                  const isImageDefault =
                    p.id === env.AI_DEFAULT_IMAGE_PROVIDER && p.id === "fal";
                  return (
                    <tr key={p.id} className="border-t border-accent-champagne/10">
                      <td className="px-3 py-2 text-ink-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{p.label}</span>
                          {(isTextDefault || isImageDefault) && (
                            <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-accent-gold">
                              {isTextDefault ? "default chat" : "default image"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-ink-300">
                        {p.envVarNames.join(" / ")}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-300">
                        {p.preview || "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-ink-300">
                        {modelLookup[p.id]?.length
                          ? modelLookup[p.id].slice(0, 2).join(" / ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          status={
                            p.configured
                              ? p.effectiveEnabled
                                ? "ok"
                                : "off"
                              : "missing"
                          }
                          label={
                            p.configured
                              ? p.effectiveEnabled
                                ? "connected"
                                : "disabled"
                              : "missing"
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link href="/api/ai/status" className="btn-ghost h-7 px-2 text-[11px]">
                          Test status
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <ProviderToggle
                            provider={p.id}
                            initialEnabled={p.ownerToggleOn}
                            canEdit={owner}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-ink-300">
            The toggle disables the provider for everyone in the org without
            touching the env var. To <em>add</em> a new provider key, set its
            env var (e.g. <code>OPENROUTER_API_KEY</code>) on the hosting
            platform and redeploy — keys never travel through the browser.
          </p>
        </div>
      ),
    },
    {
      id: "mcp",
      title: "MCP connections",
      icon: Plug,
      children: (
        <div id="mcp-connections" className="scroll-mt-24">
          <MCPConnections />
        </div>
      ),
    },
    {
      id: "branding",
      title: "Branding",
      icon: Sparkles,
      children: (
        <div>
          <p className="text-xs text-ink-300">
            Team identity line. Atlas auto-includes this when drafting outbound
            marketing copy.
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-accent-champagne/10 bg-ink-950/30 p-3 text-xs text-ink-200">
{PUBLIC_ENV.BRAND_LINE}
          </pre>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="Profile & integrations"
        description="Your profile, organization, and provider gateway snapshot. Secrets never leave the server."
        action={
          <span className="chip">
            <UserCircle size={14} /> {profile.role}
          </span>
        }
      />
      <LegendsOSHelpCoaches />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Profile</h2>
              <p>Your identity in {PUBLIC_ENV.APP_NAME}.</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <dt className="text-ink-300">Email</dt>
            <dd className="col-span-2 text-ink-100">{profile.email}</dd>
            <dt className="text-ink-300">Full name</dt>
            <dd className="col-span-2 text-ink-100">
              {profile.full_name ?? "—"}
            </dd>
            <dt className="text-ink-300">Role</dt>
            <dd className="col-span-2">
              <StatusPill status="info" label={profile.role} />
            </dd>
            <dt className="text-ink-300">Organization</dt>
            <dd className="col-span-2 text-ink-100">{PUBLIC_ENV.TEAM_NAME}</dd>
            <dt className="text-ink-300">Active since</dt>
            <dd className="col-span-2 text-ink-100">
              {formatRelative(profile.created_at)}
            </dd>
          </dl>
        </section>
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>External actions</h2>
              <p>Owner-controlled toggles for outbound publishing and sending.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {externalToggles.map((s) => (
              <li
                key={s.env_var}
                className="flex items-center justify-between rounded-lg border border-accent-champagne/10 bg-ink-950/30 px-3 py-2 backdrop-blur-sm"
              >
                <div>
                  <p className="text-ink-100">{s.label}</p>
                  <p className="text-[11px] text-ink-300">{s.env_var}</p>
                </div>
                <StatusPill
                  status={s.on ? "ok" : "warn"}
                  label={s.on ? "enabled" : "disabled"}
                />
              </li>
            ))}
          </ul>
          {!owner && (
            <p className="mt-3 text-[11px] text-ink-300">
              Only the owner can change these toggles.
            </p>
          )}
        </section>
      </div>

      <Accordion items={sections} />
    </div>
  );
}

// HARDENING: safe fallback for the env snapshot. Used only if getServerEnv()
// throws (e.g. a required var is unexpectedly missing on a fresh deploy). Every
// value resolves to an empty / disabled default so the gateway shows "missing"
// rather than crashing the whole Settings route. Shape mirrors getServerEnv()'s
// `as const` return; only the fields Settings reads need to be meaningful.
function getSafeEnvFallback(): ReturnType<typeof getServerEnv> {
  const empty = "";
  const fallback = {
    SUPABASE_URL: empty,
    SUPABASE_PUBLISHABLE_KEY: empty,
    SUPABASE_ANON_KEY: empty,
    SUPABASE_SECRET_KEY: empty,
    SUPABASE_SERVICE_ROLE_KEY: empty,
    OPENROUTER_API_KEY: empty,
    OPENROUTER_BASE_URL: empty,
    OPENROUTER_DEFAULT_MODEL: empty,
    OPENROUTER_FREE_MODELS: [] as string[],
    DEEPSEEK_API_KEY: empty,
    DEEPSEEK_BASE_URL: empty,
    DEEPSEEK_DEFAULT_MODEL: empty,
    NVIDIA_API_KEY: empty,
    NVIDIA_BASE_URL: empty,
    NVIDIA_MODELS: {
      kimi_k2_5: empty,
      nemotron_super_120b: empty,
      mistral_small_4_119b: empty,
    },
    MINIMAX_API_KEY: empty,
    MINIMAX_KEY: empty,
    MINIMAX_BASE_URL: empty,
    MINIMAX_DEFAULT_MODEL: empty,
    MINIMAX_MODELS: [] as string[],
    FAL_KEY: empty,
    FAL_API_KEY: empty,
    FAL_DEFAULT_MODEL: empty,
    FAL_FAST_IMAGE_MODEL: empty,
    FAL_PREMIUM_IMAGE_MODEL: empty,
    HF_TOKEN: empty,
    HUGGINGFACE_API_KEY: empty,
    HUGGINGFACE_DEFAULT_MODEL: empty,
    AI_DEFAULT_TEXT_PROVIDER: "openrouter",
    AI_DEFAULT_IMAGE_PROVIDER: "fal",
    N8N_BASE_URL: empty,
    N8N_WEBHOOK_BASE_URL: empty,
    N8N_WEBHOOK_SECRET: empty,
    N8N_API_KEY: empty,
    N8N_WEBHOOKS: {
      social_publish: empty,
      gbp_post: empty,
      facebook_post: empty,
      instagram_post: empty,
      youtube_post: empty,
      email_send: empty,
      daily_usage: empty,
      provider_health: empty,
      content_reminder: empty,
      failed_publish_recovery: empty,
    },
    DAILY_CAPS: { chat: 0, images: 0, social: 0, email: 0 },
    SAFETY: {
      allowLiveSocialPublish: false,
      allowLiveEmailSend: false,
      allowPaidImageGeneration: false,
      allowPaidTextGeneration: false,
    },
  };
  // The real return type is `as const` (readonly literals); cast through unknown
  // since this is a runtime-only safety net, not a literal-typed value.
  return fallback as unknown as ReturnType<typeof getServerEnv>;
}
