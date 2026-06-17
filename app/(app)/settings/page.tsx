import { headers } from "next/headers";
import Link from "next/link";
import {
  Cpu,
  HardDrive,
  MonitorCheck,
  Plug,
  Route,
  Sparkles,
  UserCircle,
  Video,
} from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { DriveLoanBrainSetup } from "@/components/settings/DriveLoanBrainSetup";
import { IntegrationConnections } from "@/components/settings/IntegrationConnections";
import { ThemeCustomizationPanel } from "@/components/settings/ThemeCustomizationPanel";
import { ProviderToggle } from "@/components/settings/ProviderToggle";
import { MCPConnections } from "@/components/settings/MCPConnections";
import { RouteOwnershipAudit } from "@/components/settings/RouteOwnershipAudit";
import {
  SettingsConnectionSetup,
  type ConnectionSetupGuide,
} from "@/components/settings/SettingsConnectionSetup";
import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
  PUBLIC_ENV,
} from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_THEME_SNAPSHOT } from "@/lib/themeSnapshot";
import {
  resolveThemeSnapshot,
  resolveWorkspaceThemeSnapshot,
  resolveWorkspaceRecord,
} from "@/lib/themeServer";
import { formatRelative } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  BrandWorkspaceSettings,
  ProviderCredentialPublic,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

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
  let providerTableSetupNeeded = false;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("provider_credentials_public")
      .select("*")
      .order("provider");
    providerTableSetupNeeded = Boolean(error);
    providerRows = (data ?? []) as ProviderCredentialPublic[];
  } catch {
    // Table missing, RLS rejection, or unconfigured supabase — degrade to no
    // stored placeholders. Live env detection below still drives the gateway.
    providerRows = [];
    providerTableSetupNeeded = true;
  }

  const owner = isOwner(profile);
  const canManageWorkspace = owner;
  const storedProviders = (providerRows ?? []) as ProviderCredentialPublic[];
  const adminOrOwner = isAdminOrOwner(profile);
  // HARDENING: provider status derivation reads env flags; guard so a bad env
  // can't take the whole page down.
  let liveStatuses: ReturnType<typeof getAIProviderStatuses>;
  try {
    liveStatuses = getAIProviderStatuses();
  } catch {
    liveStatuses = [];
  }
  const host = headers().get("x-hostname") ?? headers().get("host");
  let initialTheme = DEFAULT_THEME_SNAPSHOT;
  let workspaceTheme = DEFAULT_THEME_SNAPSHOT;
  let workspaceBranding: BrandWorkspaceSettings | null = null;
  try {
    [initialTheme, workspaceBranding] = await Promise.all([
      resolveThemeSnapshot({ profile, host }),
      resolveWorkspaceRecord({ profile, host }),
    ]);
    workspaceTheme = await resolveWorkspaceThemeSnapshot(workspaceBranding);
  } catch {
    initialTheme = DEFAULT_THEME_SNAPSHOT;
    workspaceTheme = DEFAULT_THEME_SNAPSHOT;
    workspaceBranding = null;
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
      detail:
        n8nWebhookCount > 0 || env.N8N_BASE_URL
          ? `${n8nWebhookCount} webhook${n8nWebhookCount === 1 ? "" : "s"} present (not verified)`
          : "Disabled until configured — no base URL or webhooks set",
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
    },
    {
      id: "google-oauth",
      title: "Google Workspace",
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
        "Enable Gmail, Drive, and Calendar scopes only where the app supports them.",
        "Use the Connect with Google path when it is available in the relevant module.",
      ],
      ownerAction:
        "Configure OAuth client credentials in the deployment environment. Saved values are never shown in the browser.",
      teamAction:
        "Use supported Google connection buttons when they appear. If not available, follow the setup coach instructions.",
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
    },
    {
      id: "social-platforms",
      title: "Zapier Publishing",
      detail:
        "Recommended: Connect your social accounts through Zapier for the fastest setup and highest reliability.",
      envNames: [
        "Zapier MCP URL",
        "Zapier MCP token",
        "ALLOW_LIVE_SOCIAL_PUBLISH",
      ],
      configured: false,
      icon: "plug",
      scope: "Team",
      href: "/social",
      buttonLabel: "Open Social Studio",
      steps: [
        "Connect Zapier MCP in MCP Connections.",
        "Connect Zapier to Facebook, Instagram, YouTube, TikTok, Google Business Profile, and LinkedIn.",
        "Use Social Studio with Publishing Method set to Zapier (Recommended).",
        "Keep live posting disabled unless Jeremy enables the owner flag.",
      ],
      ownerAction:
        "Verify the Zapier MCP connection and platform Zaps before enabling any external publish path.",
      teamAction: "Create and save drafts. Use Zapier as the default publishing method.",
    },
    {
      id: "zapier-mcp",
      title: "Zapier MCP",
      detail: "Personal or team MCP endpoints can be saved below",
      envNames: ["Zapier MCP URL", "Zapier MCP token"],
      // Not env-configured at the page level — real saved endpoints are shown
      // in the MCP Connections panel below. Don't fake a "ready" pill here.
      configured: false,
      icon: "plug",
      scope: "Personal",
      href: "#mcp-connections",
      buttonLabel: "Open MCP Connections",
      steps: [
        "Create the MCP endpoint in Zapier.",
        "Save the endpoint URL and token in the MCP Connections panel.",
        "Use the Zapier Publishing Wizard to choose Facebook, Instagram, YouTube, TikTok, Google Business Profile, and LinkedIn.",
      ],
      ownerAction: "Use team scoped MCP only for shared workflows and social publishing Zaps.",
      teamAction: "Use personal MCP for personal connector actions and keep tokens private.",
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
    },
    {
      id: "mcp-apps",
      title: "MCP app connections",
      detail: "User-managed endpoints live below this panel",
      envNames: ["MCP URL", "MCP token"],
      // Not env-configured at the page level — real saved endpoints are shown
      // in the MCP Connections panel below. Don't fake a "ready" pill here.
      configured: false,
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
    },
    {
      id: "ai-providers",
      title: "AI subscriptions",
      detail: `${merged.filter((p) => p.configured).length} provider key${merged.filter((p) => p.configured).length === 1 ? "" : "s"} present (not verified)`,
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
    },
  ];

  // Sections are grouped into a collapsible Accordion to cut scrolling. The
  // Profile + External actions row stays pinned above as the primary glance.
  const sections: AccordionItemData[] = [
    ...(adminOrOwner
      ? [
          {
            id: "desktop-app",
            title: "Desktop app",
            icon: <MonitorCheck size={16} />,
            defaultOpen: true,
            children: (
              <SectionErrorBoundary title="Desktop app">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white/70 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div>
                    <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                      Mac desktop setup
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                      Install instructions, native shell status,
                      traffic-light spacing, and Windows build path.
                    </p>
                  </div>
                  <Link href="/desktop/setup" className="btn-secondary text-xs">
                    <MonitorCheck size={13} />
                    Open desktop setup
                  </Link>
                </div>
              </SectionErrorBoundary>
            ),
          } satisfies AccordionItemData,
          {
            id: "connections",
            title: "Connections & setup coaches",
            meta: `${connectionGuides.filter((g) => g.configured).length}/${connectionGuides.length} keys present`,
            icon: <Plug size={16} />,
            defaultOpen: true,
            children: (
              <SectionErrorBoundary title="Connections & setup coaches">
                <SettingsConnectionSetup guides={connectionGuides} />
              </SectionErrorBoundary>
            ),
          } satisfies AccordionItemData,
        ]
      : []),
    // Owner/admin only: informational route-ownership matrix. Activates nothing.
    ...(owner
      ? [
          {
            id: "route-ownership",
            title: "Route ownership audit",
            meta: "informational",
            icon: <Route size={16} />,
            children: (
              <SectionErrorBoundary title="Route ownership audit">
                <RouteOwnershipAudit />
              </SectionErrorBoundary>
            ),
          } satisfies AccordionItemData,
        ]
      : []),
    ...(adminOrOwner
      ? [
          {
            id: "drive-loan-brain",
            title: "Drive & Loan Brain",
            icon: <HardDrive size={16} />,
            children: (
              <SectionErrorBoundary title="Drive & Loan Brain">
                <DriveLoanBrainSetup />
              </SectionErrorBoundary>
            ),
          } satisfies AccordionItemData,
        ]
      : []),
    ...(adminOrOwner
      ? [
          {
            id: "tutorials",
            title: "Setup tutorials",
            icon: <Video size={16} />,
            children: (
              // HONEST: no walkthrough videos are wired up yet. Rather than render
              // empty video placeholders that imply content exists, collapse to one
              // truthful line until real tutorial URLs are added.
              <p className="text-sm text-ink-700 dark:text-ink-300">
                Tutorials coming soon. Walkthrough videos will appear here once
                the approved recordings are published.
              </p>
            ),
          } satisfies AccordionItemData,
        ]
      : []),
    ...(adminOrOwner
      ? [
          {
            id: "ai-providers",
            title: "AI Provider Gateway",
            meta: `${merged.filter((p) => p.configured).length} keys present`,
            icon: <Cpu size={16} />,
            defaultOpen: true,
            children: (
              <SectionErrorBoundary title="AI Provider Gateway">
        <div id="ai-provider-gateway" className="scroll-mt-24">
          <div className="section-title">
            <div>
              <h2>AI Provider Gateway</h2>
              <p>
                Credential presence detected from environment variables — not a
                live connectivity test. &ldquo;Key present&rdquo; means the env
                var is set, not that the provider was reached. Secrets never
                leave the server; only masked previews are shown below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-700 dark:text-ink-300">
              <span className="uppercase tracking-[0.18em] text-[10px]">
                Atlas default:
              </span>
              <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-accent-gold">
                {env.AI_DEFAULT_TEXT_PROVIDER || "openrouter"}
              </span>
              <span className="text-ink-600 dark:text-ink-400">·</span>
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
              <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
                <tr>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Env var(s)</th>
                  <th className="px-3 py-2">Masked preview</th>
                  <th className="px-3 py-2">Models</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Status JSON</th>
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
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{p.label}</span>
                          {(isTextDefault || isImageDefault) && (
                            <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-accent-gold">
                              {isTextDefault ? "default chat" : "default image"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                        {p.envVarNames.join(" / ")}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-700 dark:text-ink-300">
                        {p.preview || "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-ink-700 dark:text-ink-300">
                        {modelLookup[p.id]?.length
                          ? modelLookup[p.id].slice(0, 2).join(" / ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {/* HONEST STATUS: a present env key is NOT verified
                            connectivity. We never call the provider from this
                            page, so the most we can claim is "key present"
                            (neutral), never green "connected". */}
                        <StatusPill
                          status={
                            p.configured
                              ? p.effectiveEnabled
                                ? "info"
                                : "off"
                              : "missing"
                          }
                          label={
                            p.configured
                              ? p.effectiveEnabled
                                ? "key present"
                                : "disabled"
                              : "setup needed"
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href="/api/ai/status"
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost h-7 px-2 text-[11px]"
                        >
                          View status (raw JSON)
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
          <p className="mt-3 text-[11px] text-ink-700 dark:text-ink-300">
            &ldquo;Key present&rdquo; means the env var is set — it has not been
            tested against the provider, so it is not a verified connection. The
            toggle disables the provider for everyone in the org without touching
            the env var. To <em>add</em> a new provider key, set its env var
            (e.g. <code>OPENROUTER_API_KEY</code>) on the hosting platform and
            redeploy — keys never travel through the browser.
          </p>
        </div>
              </SectionErrorBoundary>
            ),
          } satisfies AccordionItemData,
        ]
      : []),
    ...(adminOrOwner
      ? [
          {
            id: "branding",
            title: "Branding",
            icon: <Sparkles size={16} />,
            children: (
              <SectionErrorBoundary title="Branding">
                <div>
                  <p className="text-xs text-ink-700 dark:text-ink-300">
                    Team identity line. Atlas auto-includes this when drafting
                    outbound marketing copy.
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-ink-200 bg-ink-50 p-3 text-xs text-ink-700 dark:border-accent-champagne/10 dark:bg-ink-950/30 dark:text-ink-200">
{PUBLIC_ENV.BRAND_LINE}
                  </pre>
                </div>
              </SectionErrorBoundary>
            ),
          } satisfies AccordionItemData,
        ]
      : []),
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
      {adminOrOwner && providerTableSetupNeeded && (
        <section className="card-padded border-status-warn/30 bg-status-warn/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Provider table setup needed
              </h2>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                Stored provider toggles are unavailable, so Settings is using
                safe environment-only status and showing setup-needed states.
              </p>
            </div>
            <StatusPill status="warn" label="setup needed" />
          </div>
        </section>
      )}
      {adminOrOwner && (
        <SectionErrorBoundary title="Help coaches">
          <LegendsOSHelpCoaches />
        </SectionErrorBoundary>
      )}

      <SectionErrorBoundary title="My Connections">
        <section className="space-y-4" id="my-connections">
          <div className="section-title">
            <div>
              <h2>My Connections</h2>
              <p>
                Connect your own Gmail, Drive, Calendar, and Zapier MCP tools.
                Owner-only setup and provider controls are separated below.
              </p>
            </div>
          </div>
          <IntegrationConnections />
          <div id="mcp-connections" className="scroll-mt-24">
            <MCPConnections />
          </div>
        </section>
      </SectionErrorBoundary>

      {adminOrOwner && (
        <SectionErrorBoundary title="Theme & branding">
          <ThemeCustomizationPanel
            profile={profile}
            initialTheme={initialTheme}
            workspaceTheme={workspaceTheme}
            workspace={workspaceBranding}
            canManageWorkspace={canManageWorkspace}
          />
        </SectionErrorBoundary>
      )}

      <SectionErrorBoundary title="Profile & external actions">
        <div
          className={
            adminOrOwner
              ? "grid grid-cols-1 gap-5 lg:grid-cols-2"
              : "grid grid-cols-1 gap-5"
          }
        >
          <section className="card-padded">
            <div className="section-title">
              <div>
                <h2>Profile</h2>
                <p>Your identity in {PUBLIC_ENV.APP_NAME}.</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <dt className="text-ink-600 dark:text-ink-400">Email</dt>
              <dd className="col-span-2 text-ink-900 dark:text-ink-100">
                {profile.email}
              </dd>
              <dt className="text-ink-600 dark:text-ink-400">Full name</dt>
              <dd className="col-span-2 text-ink-900 dark:text-ink-100">
                {profile.full_name ?? "—"}
              </dd>
              <dt className="text-ink-600 dark:text-ink-400">Role</dt>
              <dd className="col-span-2">
                <StatusPill status="info" label={profile.role} />
              </dd>
              <dt className="text-ink-600 dark:text-ink-400">Organization</dt>
              <dd className="col-span-2 text-ink-900 dark:text-ink-100">
                {PUBLIC_ENV.TEAM_NAME}
              </dd>
              <dt className="text-ink-600 dark:text-ink-400">Active since</dt>
              <dd className="col-span-2 text-ink-900 dark:text-ink-100">
                {formatRelative(profile.created_at)}
              </dd>
            </dl>
          </section>
          {adminOrOwner && (
            <section className="card-padded">
              <div className="section-title">
                <div>
                  <h2>External actions</h2>
                  {/* HONEST: these are read-only status pills derived from
                  environment flags, not interactive toggles. The header must
                  not imply you can flip them here. */}
                  <p>Outbound action status (set via environment).</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {externalToggles.map((s) => (
                  <li
                    key={s.env_var}
                    className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 backdrop-blur-sm dark:border-accent-champagne/10 dark:bg-ink-950/30"
                  >
                    <div>
                      <p className="text-ink-900 dark:text-ink-100">
                        {s.label}
                      </p>
                      <p className="text-[11px] text-ink-600 dark:text-ink-400">
                        {s.env_var}
                      </p>
                    </div>
                    <StatusPill
                      status={s.on ? "ok" : "off"}
                      label={s.on ? "enabled" : "disabled until configured"}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-600 dark:text-ink-400">
                Read-only status. These flags are set in the hosting
                environment, not from this screen. Outbound sending and
                publishing stay disabled (draft only) until the owner enables the
                matching environment flag.
              </p>
            </section>
          )}
        </div>
      </SectionErrorBoundary>

      {sections.length > 0 && (
        <SectionErrorBoundary title="Settings sections">
          <Accordion items={sections} />
        </SectionErrorBoundary>
      )}
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
