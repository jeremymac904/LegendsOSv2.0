import Link from "next/link";
import {
  Bot,
  CalendarDays,
  KeyRound,
  Mail,
  PlugZap,
  Video,
} from "lucide-react";

import { ProviderToggle } from "@/components/settings/ProviderToggle";
import { MCPConnections } from "@/components/settings/MCPConnections";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getAIProviderStatuses,
  getServerEnv,
  maskedKeyPreview,
  PUBLIC_ENV,
} from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { ProviderCredentialPublic } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const { data: providerRows } = await supabase
    .from("provider_credentials_public")
    .select("*")
    .order("provider");

  const owner = isOwner(profile);
  const storedProviders = (providerRows ?? []) as ProviderCredentialPublic[];
  const liveStatuses = getAIProviderStatuses();
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
  const connectionGuides = [
    {
      title: "n8n workflow broker",
      detail: `${n8nWebhookCount} webhook${n8nWebhookCount === 1 ? "" : "s"} configured`,
      envNames: "N8N_BASE_URL / N8N_WEBHOOK_*",
      configured: Boolean(env.N8N_BASE_URL || n8nWebhookCount > 0),
      icon: PlugZap,
      href: "/admin",
    },
    {
      title: "HeyGen welcome video",
      detail: process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL
        ? "Login welcome video URL present"
        : "Embed URL missing",
      envNames: "NEXT_PUBLIC_WELCOME_VIDEO_URL",
      configured: Boolean(process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL),
      icon: Video,
      href: "/login",
    },
    {
      title: "Google, Gmail, Calendar",
      detail:
        process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
          ? "OAuth client present"
          : "OAuth client missing",
      envNames: "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET",
      configured: Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ),
      icon: CalendarDays,
      href: "/calendar",
    },
    {
      title: "Google Drive",
      detail:
        process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
          ? "OAuth client present"
          : "OAuth client missing",
      envNames: "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET",
      configured: Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ),
      icon: CalendarDays,
      href: "/knowledge",
    },
    {
      title: "Meta, YouTube, GBP",
      detail: "Social publishing stays draft-only until webhooks and owner flags are on",
      envNames: "N8N_WEBHOOK_FACEBOOK_POST / N8N_WEBHOOK_INSTAGRAM_POST / N8N_WEBHOOK_YOUTUBE_POST / N8N_WEBHOOK_GBP_POST",
      configured: Boolean(
        env.N8N_WEBHOOKS.facebook_post ||
          env.N8N_WEBHOOKS.instagram_post ||
          env.N8N_WEBHOOKS.youtube_post ||
          env.N8N_WEBHOOKS.gbp_post
      ),
      icon: PlugZap,
      href: "/social",
    },
    {
      title: "Zapier MCP",
      detail: "Personal or team MCP endpoints can be saved below",
      envNames: "Zapier MCP URL / token",
      configured: true,
      icon: PlugZap,
      href: "#mcp-connections",
    },
    {
      title: "Telegram bot actions",
      detail: process.env.TELEGRAM_BOT_TOKEN
        ? "Bot token present"
        : "Bot token missing",
      envNames: "TELEGRAM_BOT_TOKEN",
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      icon: Bot,
      href: "/atlas",
    },
    {
      title: "MCP app connections",
      detail: "User-managed endpoints live below this panel",
      envNames: "Zapier / Composio / custom MCP URL",
      configured: true,
      icon: Mail,
      href: "#mcp-connections",
    },
    {
      title: "AI subscriptions",
      detail: `${merged.filter((p) => p.configured).length} provider${merged.filter((p) => p.configured).length === 1 ? "" : "s"} configured`,
      envNames: "OPENROUTER / FAL / HF / DeepSeek / NVIDIA / MINIMAX",
      configured: merged.some((p) => p.configured),
      icon: KeyRound,
      href: "#ai-provider-gateway",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="Profile & integrations"
        description="Your profile, organization, and provider gateway snapshot. Secrets never leave the server."
      />
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
                className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2"
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

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Connection setup</h2>
            <p>
              Per-user and owner-level integration paths Jeremy called out:
              n8n, HeyGen, Google, Gmail, Telegram, MCPs, and AI subscriptions.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {connectionGuides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Link
                key={guide.title}
                href={guide.href}
                className="rounded-xl border border-ink-800 bg-ink-900/40 p-3 transition hover:border-accent-gold/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                    <Icon size={16} />
                  </div>
                  <StatusPill
                    status={guide.configured ? "ok" : "warn"}
                    label={guide.configured ? "ready" : "setup needed"}
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-ink-100">
                  {guide.title}
                </p>
                <p className="mt-1 text-xs text-ink-300">{guide.detail}</p>
                <p className="mt-2 font-mono text-[10px] text-ink-400">
                  {guide.envNames}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Setup tutorials</h2>
            <p>Video lanes for owner, team, and personal connector onboarding.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Owner broker setup", "n8n, provider keys, live action flags"],
            ["Team connector setup", "MCP, Google, Gmail, Calendar, Drive"],
            ["Personal workspace setup", "Per-user providers and project knowledge"],
          ].map(([title, detail]) => (
            <div
              key={title}
              className="overflow-hidden rounded-xl border border-ink-800 bg-ink-900/35"
            >
              <div className="grid aspect-video place-items-center border-b border-ink-800 bg-ink-950/70">
                <Video size={22} className="text-accent-gold/80" />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-ink-100">{title}</p>
                <p className="mt-1 text-xs text-ink-300">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="ai-provider-gateway" className="card-padded">
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
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
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
                <tr key={p.id} className="border-t border-ink-800">
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
      </section>

      <div id="mcp-connections">
        <MCPConnections />
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Branding</h2>
            <p>
              Team identity line. Atlas auto-includes this when drafting outbound
              marketing copy.
            </p>
          </div>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-xs text-ink-200">
{PUBLIC_ENV.BRAND_LINE}
        </pre>
      </section>
    </div>
  );
}
