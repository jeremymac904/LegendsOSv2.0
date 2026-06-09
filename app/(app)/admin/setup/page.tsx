import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  HardDrive,
  KeyRound,
  Mail,
  Megaphone,
  MonitorSmartphone,
  PlugZap,
  Share2,
  Workflow,
} from "lucide-react";

import {
  TeamSetupClient,
  type ProvisionedUser,
} from "@/components/admin/TeamSetupClient";
import type {
  RosterRow,
  RosterRowStatus,
} from "@/components/admin/RosterStatusTable";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isZapierMcpConfigured } from "@/lib/automation/zapier-mcp";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { PUBLIC_ENV } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { isOwner } from "@/lib/permissions";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import {
  ROSTER_COUNT,
  ROSTER_EXCLUDED,
  TEAM_ROSTER,
  rosterEmails,
} from "@/lib/team/roster";
import type { Profile, UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Allowed honest status labels only. Never "ready" on env presence alone.
//   "connected/verified" | "key present (not verified)" | "setup needed"
//   | "disabled" | "unknown" | "not connected"
// ---------------------------------------------------------------------------
type HonestLabel =
  | "connected/verified"
  | "key present (not verified)"
  | "setup needed"
  | "disabled"
  | "unknown"
  | "not connected";

function pillFor(label: HonestLabel): "ok" | "warn" | "off" | "info" {
  switch (label) {
    case "connected/verified":
      return "ok";
    case "key present (not verified)":
      return "info";
    case "disabled":
      return "off";
    case "not connected":
    case "setup needed":
    case "unknown":
    default:
      return "warn";
  }
}

// Highest-privilege-wins ordering for the roster→profile matcher. When a roster
// member's emails (canonical + alt) resolve to more than one live profile, we
// prefer the one whose role EQUALS the expected role; failing that, we prefer
// the most privileged profile. This stops Jeremy's canonical loanfactory
// loan_officer profile from out-matching his real owner profile.
const ROLE_PRIORITY: Record<UserRole, number> = {
  owner: 6,
  admin: 5,
  coordinator: 4,
  processor: 3,
  marketing: 2,
  loan_officer: 1,
  viewer: 0,
};

function rolePriority(role: UserRole | null | undefined): number {
  if (!role) return -1;
  return ROLE_PRIORITY[role] ?? -1;
}

export default async function TeamSetupPage() {
  // Owner gate — mirrors app/(app)/admin/page.tsx exactly.
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  let profileRowsSetupNeeded = false;
  let profileRows: Pick<
    Profile,
    "id" | "email" | "full_name" | "role" | "is_active"
  >[] = [];
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,is_active")
      .order("role", { ascending: true })
      .order("email", { ascending: true });
    profileRowsSetupNeeded = Boolean(error);
    profileRows = (data ?? []) as Pick<
      Profile,
      "id" | "email" | "full_name" | "role" | "is_active"
    >[];
  } catch {
    profileRowsSetupNeeded = true;
  }

  const profiles = profileRows as Pick<
    Profile,
    "id" | "email" | "full_name" | "role" | "is_active"
  >[];

  // Index profiles by lowercased email for case-insensitive roster matching.
  const profilesByEmail = new Map<
    string,
    Pick<Profile, "id" | "email" | "full_name" | "role" | "is_active">
  >();
  for (const p of profiles) {
    if (p.email) profilesByEmail.set(p.email.trim().toLowerCase(), p);
  }

  // ---------------------------------------------------------------------
  // Last-login visibility. Read auth last_sign_in_at per user via the Auth
  // Admin API (service role). Wrapped in try/catch and paginated so a failure
  // degrades to an empty map ("—" in the UI) rather than 500-ing the page.
  // ---------------------------------------------------------------------
  const lastLoginByEmail = new Map<string, string | null>();
  // Did the lookup actually succeed? When false we render "—" (unknown) rather
  // than misreporting everyone as "never signed in".
  let lastLoginLookupOk = false;
  try {
    const service = getSupabaseServiceClient();
    const PER_PAGE = 200;
    for (let page = 1; page <= 50; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await service.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (error) throw error;
      const users = data?.users ?? [];
      for (const u of users) {
        if (u.email) {
          lastLoginByEmail.set(
            u.email.trim().toLowerCase(),
            u.last_sign_in_at ?? null
          );
        }
      }
      lastLoginLookupOk = true;
      if (users.length < PER_PAGE) break; // last page reached
    }
  } catch {
    // Service client unavailable or the call failed — mark the lookup as failed
    // so the table renders "—" for last login instead of crashing the page.
    lastLoginLookupOk = false;
  }

  // Build one serializable RosterRow per verified member.
  const rosterRows: RosterRow[] = TEAM_ROSTER.map((member) => {
    const emails = rosterEmails(member); // already lowercased

    // A roster member can resolve to more than one live profile (canonical +
    // alt emails). Collect every match, then pick the best one: prefer a
    // profile whose role equals the expected role; otherwise prefer the
    // highest-privilege profile. This resolves the owner to his owner profile
    // even when a loan_officer profile shares one of his emails.
    const candidates = emails
      .map((e) => profilesByEmail.get(e))
      .filter(
        (p): p is Pick<
          Profile,
          "id" | "email" | "full_name" | "role" | "is_active"
        > => Boolean(p)
      );
    // De-duplicate by profile id (alt emails can point at the same row).
    const seen = new Set<string>();
    const uniqueCandidates = candidates.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    const matched =
      uniqueCandidates.find((p) => (p.role as UserRole) === member.role) ??
      uniqueCandidates
        .slice()
        .sort(
          (a, b) =>
            rolePriority(b.role as UserRole) - rolePriority(a.role as UserRole)
        )[0] ??
      null;

    // Last login for whichever email actually matched the chosen profile, or
    // any of the roster emails if none of them carry a value yet. When the
    // lookup itself failed, leave this undefined so the cell renders "—" instead
    // of a misleading "never signed in".
    const matchedEmailKey = matched?.email?.trim().toLowerCase() ?? null;
    let lastLoginAt: string | null | undefined = lastLoginLookupOk
      ? null
      : undefined;
    if (lastLoginLookupOk) {
      if (matchedEmailKey && lastLoginByEmail.has(matchedEmailKey)) {
        lastLoginAt = lastLoginByEmail.get(matchedEmailKey) ?? null;
      } else {
        for (const e of emails) {
          if (lastLoginByEmail.has(e)) {
            lastLoginAt = lastLoginByEmail.get(e) ?? null;
            break;
          }
        }
      }
    }

    const liveRole = (matched?.role as UserRole | undefined) ?? null;
    const isActive = matched ? matched.is_active : null;
    const roleMatches = Boolean(matched && liveRole === member.role);
    const profileComplete = Boolean(
      matched?.full_name && matched.full_name.trim() !== ""
    );

    let status: RosterRowStatus;
    if (!matched) status = "not_created";
    else if (!roleMatches) status = "wrong_role";
    else if (isActive) status = "provisioned_active";
    else status = "provisioned_inactive";

    return {
      name: member.name,
      email: member.email,
      expectedRole: member.role,
      title: member.title,
      phone: member.phone,
      states: member.states,
      profileId: matched?.id ?? null,
      profileEmail: matched?.email ?? null,
      profileFullName: matched?.full_name ?? null,
      liveRole,
      isActive,
      status,
      roleMatches,
      profileComplete,
      lastLoginAt,
    };
  });

  // Provisioned users for role/active/preview controls (every live profile).
  const provisionedUsers: ProvisionedUser[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role: p.role,
    is_active: p.is_active,
  }));

  // ---------------------------------------------------------------------
  // Integration status (honest, presence-not-values).
  // ---------------------------------------------------------------------
  const drive = getDriveConnectionStatus();
  const n8n = getN8nConfigState();
  const zapier = isZapierMcpConfigured();
  const gmailSecret = isWebhookSecretConfigured();
  const meta = detectMetaConfig();
  const googleOAuthPresent = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  const netlifyUrl = "https://legndsosv20.netlify.app";
  let ownerCalendarConnected = false;

  try {
    const { data, error } = await getSupabaseServerClient()
      .from("user_integration_connections")
      .select("status")
      .eq("user_id", profile.id)
      .eq("provider", "google_calendar")
      .maybeSingle();
    if (!error && data?.status?.toLowerCase() === "connected") {
      ownerCalendarConnected = true;
    }
  } catch {
    // keep honest placeholder state
  }

  const integrations: {
    title: string;
    detail: string;
    label: HonestLabel;
    icon: typeof Mail;
    href?: string;
  }[] = [
    {
      title: "Gmail AI intake",
      detail: gmailSecret
        ? "Webhook secret present — intake endpoint can authenticate inbound n8n calls. Not verified end-to-end."
        : "No webhook secret set (LEGENDSOS_WEBHOOK_SECRET). Intake is not provisioned.",
      label: gmailSecret ? "key present (not verified)" : "setup needed",
      icon: Mail,
      href: "/settings",
    },
    {
      title: "Google Drive (Loan Brain)",
      detail: drive.reason,
      label: drive.connected
        ? "connected/verified"
        : googleOAuthPresent
        ? "key present (not verified)"
        : "setup needed",
      icon: HardDrive,
      href: "/loanbrain",
    },
    {
      title: "Google login / OAuth",
      detail: googleOAuthPresent
        ? "GOOGLE_OAUTH_CLIENT_ID / _SECRET present (names detected). Sign-in flow not verified here."
        : "Google OAuth client not configured (GOOGLE_OAUTH_CLIENT_ID / _SECRET missing).",
      label: googleOAuthPresent ? "key present (not verified)" : "setup needed",
      icon: KeyRound,
      href: "/settings",
    },
    {
      title: "Google Calendar",
      detail: googleOAuthPresent
        ? ownerCalendarConnected
          ? "Owner user connected Google Calendar successfully."
          : "Depends on the Google OAuth client (present), then per-user calendar consent."
        : "Needs the Google OAuth client first, then per-user calendar consent.",
      label: googleOAuthPresent
        ? ownerCalendarConnected
          ? "connected/verified"
          : "setup needed"
        : "setup needed",
      icon: CalendarDays,
      href: "/calendar",
    },
    {
      title: "n8n automations",
      detail: n8n.configured
        ? "Base URL + at least one webhook configured. Dispatch stays off until the owner enables live sends."
        : n8n.base_url_present
        ? "Base URL present but no webhooks configured yet."
        : "No n8n base URL or webhooks configured.",
      label: n8n.configured
        ? "key present (not verified)"
        : "setup needed",
      icon: Workflow,
      href: "/settings",
    },
    {
      title: "Zapier Publishing",
      detail: zapier
        ? "Zapier MCP key present (not verified). Recommended social path: Zapier -> Facebook, Instagram, YouTube, TikTok, Google Business Profile, and LinkedIn."
        : "Connect Zapier MCP in Settings. Recommended: Connect social accounts through Zapier for the fastest setup and highest reliability.",
      label: zapier ? "key present (not verified)" : "not connected",
      icon: PlugZap,
      href: "/settings",
    },
    {
      title: "Meta Direct API (optional)",
      detail: meta.configured
        ? meta.paid_enabled
          ? "Advanced direct API path is configured and live publishing is allowed. Zapier remains the recommended publishing method."
          : "Advanced direct API path is configured, but live publishing is off (ALLOW_LIVE_SOCIAL_PUBLISH=false)."
        : "Optional direct API path is not configured. Use Zapier for the recommended social publishing path.",
      label: meta.configured
        ? meta.paid_enabled
          ? "key present (not verified)"
          : "disabled"
        : "disabled",
      icon: Megaphone,
      href: "/social",
    },
    {
      title: "Desktop app",
      detail:
        "Desktop shell loads the hosted site. Status can't be detected from the server — confirm on the machine running the app.",
      label: "unknown",
      icon: MonitorSmartphone,
    },
    {
      title: "Netlify production",
      detail: `${PUBLIC_ENV.APP_NAME} production deploy target: ${netlifyUrl}. Confirm by loading the live site (no GitHub deploy check is posted).`,
      label: "unknown",
      icon: Share2,
      href: netlifyUrl,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Team Setup"
        title="Real team access & onboarding"
        description={`Provision the ${ROSTER_COUNT} verified roster members, manage roles, and preview each persona — without sending a single email. Every integration status below is honest: nothing is marked connected unless it actually is.`}
        action={<StatusPill status="ok" label="owner" />}
      />

      {profileRowsSetupNeeded && (
        <section className="card-padded border-status-warn/30 bg-status-warn/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Profiles table setup needed
              </h2>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                Live roster rows are unavailable, so setup is rendering the
                verified roster checklist with empty database matches.
              </p>
            </div>
            <StatusPill status="warn" label="setup needed" />
          </div>
        </section>
      )}

      {/* Integration status — honest, presence-not-values */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Integration status</h2>
            <p>
              Presence-only detection (env var names, never values). Labels are
              honest — &quot;key present (not verified)&quot; means we found
              config but have not confirmed a live connection.
            </p>
          </div>
          <Link href="/settings" className="btn-ghost text-xs">
            <PlugZap size={14} />
            Open Settings
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((item) => {
            const Icon = item.icon;
            const card = (
              <div className="flex h-full flex-col rounded-xl border border-ink-200 bg-white/60 p-3 transition hover:border-accent-gold/30 dark:border-ink-800 dark:bg-ink-900/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                    <Icon size={16} />
                  </div>
                  <StatusPill status={pillFor(item.label)} label={item.label} />
                </div>
                <p className="mt-3 text-sm font-medium text-ink-900 dark:text-ink-100">
                  {item.title}
                </p>
                <p className="mt-1 flex-1 text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                  {item.detail}
                </p>
              </div>
            );
            if (item.href) {
              const external = item.href.startsWith("http");
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  prefetch={external ? false : undefined}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className="block"
                >
                  {card}
                </Link>
              );
            }
            return <div key={item.title}>{card}</div>;
          })}
        </div>
        <p className="text-[11px] text-ink-600 dark:text-ink-300">
          Excluded from the roster on purpose (never auto-added):{" "}
          {ROSTER_EXCLUDED.join(", ")}.
        </p>
      </section>

      {/* Provisioning + onboarding console + roster checklist */}
      <TeamSetupClient
        rosterRows={rosterRows}
        provisionedUsers={provisionedUsers}
        ownerProfileId={profile.id}
        rosterCount={ROSTER_COUNT}
      />
    </div>
  );
}
