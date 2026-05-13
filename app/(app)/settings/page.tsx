import { ProviderToggle } from "@/components/settings/ProviderToggle";
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
                <th className="px-3 py-2">Status</th>
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
