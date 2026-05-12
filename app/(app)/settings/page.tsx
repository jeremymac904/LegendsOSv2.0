import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv, PUBLIC_ENV } from "@/lib/env";
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
  const providers = (providerRows ?? []) as ProviderCredentialPublic[];

  const safety = [
    {
      label: "Live social publish",
      on: env.SAFETY.allowLiveSocialPublish,
      env_var: "ALLOW_LIVE_SOCIAL_PUBLISH",
    },
    {
      label: "Live email send",
      on: env.SAFETY.allowLiveEmailSend,
      env_var: "ALLOW_LIVE_EMAIL_SEND",
    },
    {
      label: "Paid image generation",
      on: env.SAFETY.allowPaidImageGeneration,
      env_var: "ALLOW_PAID_IMAGE_GENERATION",
    },
    {
      label: "Paid text generation",
      on: env.SAFETY.allowPaidTextGeneration,
      env_var: "ALLOW_PAID_TEXT_GENERATION",
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
              <h2>Safety flags</h2>
              <p>Hard-blocks live external actions.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {safety.map((s) => (
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
                  label={s.on ? "on" : "off"}
                />
              </li>
            ))}
          </ul>
          {!owner && (
            <p className="mt-3 text-[11px] text-ink-300">
              Only the owner can change safety flags.
            </p>
          )}
        </section>
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>AI Provider Gateway</h2>
            <p>
              Server-side credential status. Secrets stay in env vars; this view
              only shows the public-safe status.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Env var</th>
                <th className="px-3 py-2">Masked preview</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-300">
                    No provider rows. Run the bootstrap migration.
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr key={p.id} className="border-t border-ink-800">
                    <td className="px-3 py-2 capitalize text-ink-100">{p.provider}</td>
                    <td className="px-3 py-2 text-ink-300">{p.env_var_name}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-300">
                      {p.masked_preview ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {p.is_enabled ? "yes" : "no"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(p.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-300">
          To configure a provider, set its env var in <code>.env.local</code>{" "}
          (or your hosting platform), then mark its status row{" "}
          <code>configured</code> via SQL or the upcoming owner tooling.
        </p>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Compliance</h2>
            <p>Auto-applied to outbound marketing copy.</p>
          </div>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-xs text-ink-200">
{PUBLIC_ENV.COMPLIANCE_LINE}
        </pre>
      </section>
    </div>
  );
}
