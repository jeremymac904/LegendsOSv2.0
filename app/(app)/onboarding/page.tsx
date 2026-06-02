import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Brain,
  Calendar,
  CheckCircle2,
  Circle,
  HardDrive,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { getAIProviderStatuses, PUBLIC_ENV } from "@/lib/env";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { getEffectiveProfile } from "@/lib/impersonation";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { rosterByEmail } from "@/lib/team/roster";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

// Honest status vocabulary — these are the ONLY labels we allow on this page.
// Each card resolves to exactly one of these so nothing ever fakes a
// "connected" state it can't back up with a real check.
type HonestStatus =
  | "connected/verified"
  | "key present (not verified)"
  | "setup needed"
  | "disabled"
  | "unknown"
  | "not connected";

const STATUS_TONE: Record<HonestStatus, string> = {
  "connected/verified": "chip-ok",
  "key present (not verified)": "chip-info",
  "setup needed": "chip-warn",
  disabled: "chip-off",
  unknown: "chip-off",
  "not connected": "chip-off",
};

const STATUS_DOT: Record<HonestStatus, string> = {
  "connected/verified": "bg-status-ok",
  "key present (not verified)": "bg-status-info",
  "setup needed": "bg-status-warn",
  disabled: "bg-status-off",
  unknown: "bg-status-off",
  "not connected": "bg-status-off",
};

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Team Leader (Owner)",
  admin: "Administrator",
  loan_officer: "Loan Officer",
  processor: "Processor",
  coordinator: "Loan Coordinator",
  marketing: "Marketing",
  viewer: "Viewer",
};

interface IntegrationCard {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number | string }>;
  status: HonestStatus;
  /** What's true right now — honest one-liner. */
  detail: string;
  /** The concrete next step the user (or owner) can take. */
  nextStep: string;
  /** Optional in-app link that actually works today. */
  href?: string;
  hrefLabel?: string;
  /** When the connect action isn't built yet, why the button is disabled. */
  disabledReason?: string;
}

export default async function OnboardingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) redirect("/login");

  const roleLabel = ROLE_LABEL[profile.role] ?? profile.role;
  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";
  const roster = rosterByEmail(profile.email);

  // ---------------------------------------------------------------------------
  // Profile completeness — real checks against the actual profile row.
  // ---------------------------------------------------------------------------
  const checklist: { label: string; done: boolean; hint: string }[] = [
    {
      label: "Display name set",
      done: Boolean(profile.full_name && profile.full_name.trim()),
      hint: "Add your full name so the team and Atlas know who you are.",
    },
    {
      label: "Role assigned",
      done: Boolean(profile.role),
      hint: "Your role controls which surfaces and tools you can open.",
    },
    {
      label: "Account active",
      done: profile.is_active === true,
      hint: "An inactive account can sign in but can't act — ask the owner to activate it.",
    },
    {
      label: "Found on the team roster",
      done: Boolean(roster),
      hint: "Roster match gives you your title, direct line, and licensed states.",
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const completePct = Math.round((doneCount / checklist.length) * 100);

  // ---------------------------------------------------------------------------
  // Honest integration status — derived ONLY from the sanctioned helpers.
  // No env values are read here. Per-user OAuth connect flows are not built
  // yet, so Google / Gmail / Calendar render as "setup needed (coming soon)"
  // with honestly disabled buttons rather than a fake connect.
  // ---------------------------------------------------------------------------
  const providers = getAIProviderStatuses();
  const anyTextProviderReady = providers.some(
    (p) => p.id !== "fal" && p.configured && p.enabled
  );
  const drive = getDriveConnectionStatus();
  // checklist[0].done reflects Google OAuth client presence (presence-only).
  const googleOAuthPresent = Boolean(drive.checklist?.[0]?.done);
  const gmailIntakeConfigured = isWebhookSecretConfigured();
  const n8n = getN8nConfigState();

  const integrations: IntegrationCard[] = [
    {
      id: "google-login",
      title: "Google sign-in",
      icon: ShieldCheck,
      status: googleOAuthPresent ? "key present (not verified)" : "setup needed",
      detail: googleOAuthPresent
        ? "A Google OAuth client is configured on the server, but per-user Google sign-in isn't wired up yet — you're signed in with email today."
        : "Per-user Google sign-in isn't connected yet. You're signed in with your email and password.",
      nextStep:
        "Coming soon. Until then, keep using your email login — nothing else is required.",
      disabledReason: "Per-user Google sign-in isn't built yet.",
    },
    {
      id: "gmail",
      title: "Gmail",
      icon: Mail,
      status: gmailIntakeConfigured
        ? "key present (not verified)"
        : "setup needed",
      detail: gmailIntakeConfigured
        ? "The Gmail intake secret is configured on the server, but per-user Gmail connect isn't built — no mailbox is linked to your account yet."
        : "Connecting your Gmail (for AI intake and drafts) isn't available yet.",
      nextStep:
        "Coming soon. The owner provisions Gmail intake centrally — there's nothing to click here yet.",
      disabledReason: "Per-user Gmail connect isn't built yet.",
    },
    {
      id: "drive",
      title: "Google Drive (Loan Brain)",
      icon: HardDrive,
      // driveStatus is the single source of truth and is hard-false today.
      status: drive.connected
        ? "connected/verified"
        : googleOAuthPresent
        ? "key present (not verified)"
        : "setup needed",
      detail: drive.reason,
      nextStep: drive.connected
        ? "Live read-only Drive is active — open Loan Brain to browse real folders."
        : "Loan Brain runs on safe sample data. The owner enables read-only Drive centrally.",
      href: "/loan-brain",
      hrefLabel: "Open Loan Brain",
    },
    {
      id: "calendar",
      title: "Google Calendar",
      icon: Calendar,
      status: "setup needed",
      detail:
        "Per-user calendar sync isn't connected yet. Your in-app calendar still works for scheduling content and events.",
      nextStep:
        "Coming soon. Use the in-app Calendar in the meantime — it needs no external connection.",
      href: "/calendar",
      hrefLabel: "Open Calendar",
      disabledReason: "Per-user calendar sync isn't built yet.",
    },
    {
      id: "atlas",
      title: "Atlas readiness",
      icon: Brain,
      status: anyTextProviderReady
        ? "key present (not verified)"
        : "not connected",
      detail: anyTextProviderReady
        ? "An AI text provider is configured and enabled, so Atlas can answer. Responses aren't independently verified here."
        : "No AI text provider is configured yet — Atlas will tell you so until the owner adds one.",
      nextStep: anyTextProviderReady
        ? "You're good to go — start a chat with Atlas."
        : "The owner configures an AI provider in Settings.",
      href: anyTextProviderReady ? "/atlas" : "/settings",
      hrefLabel: anyTextProviderReady ? "Open Atlas" : "Open Settings",
    },
    {
      id: "loan-brain",
      title: "Loan Brain data source",
      icon: Sparkles,
      status: drive.mode === "live" ? "connected/verified" : "setup needed",
      detail:
        drive.mode === "live"
          ? "Loan Brain is reading live, read-only Drive data."
          : "Loan Brain is in sample mode — every read returns safe demo data, never a real borrower.",
      nextStep:
        drive.mode === "live"
          ? "Open Loan Brain to work from live folders."
          : "Sample mode is the safe default. Owner enables live read-only Drive when ready.",
      href: "/loan-brain",
      hrefLabel: "Open Loan Brain",
    },
    {
      id: "notifications",
      title: "Notifications & automation",
      icon: Bell,
      // n8n powers reminders / scheduled sends. Honest about config presence.
      status: n8n.configured ? "key present (not verified)" : "setup needed",
      detail: n8n.configured
        ? "Automation (n8n) is configured on the server. Outbound sends still stay off until the owner explicitly enables them."
        : "No notification/automation pipeline is wired up yet — reminders and scheduled sends are not active.",
      nextStep: n8n.configured
        ? "Nothing to do — the owner controls when automation actually sends."
        : "The owner configures n8n centrally. No per-user setup is required.",
      disabledReason: n8n.configured
        ? undefined
        : "Automation isn't wired up yet.",
    },
  ];

  // ---------------------------------------------------------------------------
  // Role-aware next action.
  // ---------------------------------------------------------------------------
  const primaryAction = nextActionForRole(profile.role);
  const PrimaryIcon = primaryAction.icon;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Onboarding"
        title={`Welcome${firstName ? `, ${firstName}` : ""}.`}
        description={`Here's your access on ${PUBLIC_ENV.TEAM_NAME} — your role, your profile, and exactly what is and isn't connected yet. No guesses, no fake "ready" states.`}
        action={
          <Link href={primaryAction.href} className="btn-primary">
            <PrimaryIcon size={14} />
            {primaryAction.label}
          </Link>
        }
      />

      {/* Role + roster identity */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card-padded space-y-4">
          <div className="section-title">
            <div>
              <h2>Your role &amp; team identity</h2>
              <p>What you can open, and how you appear to the team.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip-ok">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-status-ok" />
              {roleLabel}
            </span>
            {roster ? (
              <span className="chip-info">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-status-info" />
                On the team roster
              </span>
            ) : (
              <span className="chip-warn">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-status-warn" />
                Not on the roster
              </span>
            )}
          </div>

          {roster ? (
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <IdentityRow icon={UserCircle} label="Title" value={roster.title} />
              <IdentityRow
                icon={Phone}
                label="Direct line"
                value={roster.phone ?? "Not on file"}
              />
              <IdentityRow
                icon={MapPin}
                label="Licensed states"
                value={
                  roster.states.length > 0
                    ? roster.states.join(", ")
                    : "None listed"
                }
              />
              <IdentityRow icon={Mail} label="Roster email" value={roster.email} />
            </dl>
          ) : (
            <p className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-950/30 p-3 text-xs text-ink-700 dark:text-ink-300">
              We couldn&apos;t match <span className="font-medium">{profile.email}</span>{" "}
              to the verified team roster, so there&apos;s no title, direct line,
              or licensed-state info to show. If that&apos;s wrong, ask the owner
              to confirm the email on your account matches your roster email.
            </p>
          )}
        </div>

        {/* Profile + completeness */}
        <div className="card-padded space-y-4">
          <div className="section-title">
            <div>
              <h2>Your profile</h2>
              <p>{completePct}% complete · {doneCount} of {checklist.length} checks pass.</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <IdentityRow
              icon={UserCircle}
              label="Name"
              value={profile.full_name?.trim() || "Not set"}
            />
            <IdentityRow icon={Mail} label="Email" value={profile.email} />
            <IdentityRow icon={KeyRound} label="Role" value={roleLabel} />
            <IdentityRow
              icon={ShieldCheck}
              label="Account"
              value={profile.is_active ? "Active" : "Inactive"}
            />
          </dl>

          <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100/70 dark:bg-ink-800/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-champagne via-accent-gold to-accent-orange"
              style={{ width: `${completePct}%` }}
            />
          </div>

          <ul className="grid grid-cols-1 gap-1.5">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-xs">
                {c.done ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-status-ok" />
                ) : (
                  <Circle size={14} className="mt-0.5 shrink-0 text-ink-400" />
                )}
                <span>
                  <span
                    className={
                      c.done
                        ? "font-medium text-ink-900 dark:text-ink-100"
                        : "font-medium text-ink-700 dark:text-ink-200"
                    }
                  >
                    {c.label}
                  </span>
                  {!c.done && (
                    <span className="block text-ink-600 dark:text-ink-400">{c.hint}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {!checklist[0].done && (
            <Link href="/settings" className="btn-ghost w-fit text-xs">
              <UserCircle size={14} />
              Update profile in Settings
            </Link>
          )}
        </div>
      </section>

      {/* Integration status */}
      <section>
        <div className="section-title mb-3">
          <div>
            <h2>Integration status</h2>
            <p>
              Honest, per-integration. Anything not wired up yet says so — and
              its button is disabled with the reason, not faked green.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((card) => (
            <IntegrationStatusCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* Next action */}
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your next step</h2>
            <p>{primaryAction.description}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={primaryAction.href} className="btn-primary text-xs">
            <PrimaryIcon size={14} />
            {primaryAction.label}
          </Link>
          <Link href="/atlas" className="btn-ghost text-xs">
            <MessageCircle size={14} />
            Start an Atlas chat
          </Link>
          <Link href="/settings" className="btn-ghost text-xs">
            <KeyRound size={14} />
            Open Settings
          </Link>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers (server-rendered, no client JS).
// ---------------------------------------------------------------------------

function IdentityRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number | string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-950/30 p-2.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        <Icon size={12} />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-ink-900 dark:text-ink-100" title={value}>
        {value}
      </dd>
    </div>
  );
}

function IntegrationStatusCard({ card }: { card: IntegrationCard }) {
  const Icon = card.icon;
  return (
    <div className="card-padded flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-orange/30 to-accent-gold/20 text-accent-gold">
            <Icon size={15} />
          </span>
          <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
            {card.title}
          </p>
        </div>
        <span className={STATUS_TONE[card.status]}>
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[card.status]}`}
          />
          {card.status}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-ink-700 dark:text-ink-300">
        {card.detail}
      </p>

      <p className="mt-auto text-[11px] text-ink-600 dark:text-ink-400">
        <span className="font-medium text-ink-700 dark:text-ink-300">Next:</span>{" "}
        {card.nextStep}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {card.href && card.hrefLabel ? (
          <Link href={card.href} className="btn-ghost text-xs">
            {card.hrefLabel}
            <ArrowRight size={12} />
          </Link>
        ) : null}
        {card.disabledReason ? (
          <button
            type="button"
            disabled
            title={card.disabledReason}
            aria-label={`Connect ${card.title} — ${card.disabledReason}`}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-400 opacity-60 dark:border-ink-800 dark:text-ink-500"
          >
            Connect — coming soon
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Role -> the single most useful place to land next.
function nextActionForRole(role: UserRole): {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string }>;
} {
  switch (role) {
    case "loan_officer":
      return {
        href: "/my-loans",
        label: "Open My Loans",
        description:
          "Jump into your pipeline, then ask Atlas anything about a file.",
        icon: Sparkles,
      };
    case "processor":
      return {
        href: "/flo-processing",
        label: "Open Processing",
        description:
          "Head to the processing queue to work conditions and handoffs.",
        icon: Sparkles,
      };
    case "coordinator":
      return {
        href: "/coordinator",
        label: "Open Coordinator",
        description:
          "Open the coordinator view to keep loans moving across the team.",
        icon: Sparkles,
      };
    case "owner":
    case "admin":
      return {
        href: "/dashboard",
        label: "Open Dashboard",
        description:
          "Head to your command center, then provision the rest of the team in Admin.",
        icon: Sparkles,
      };
    case "marketing":
      return {
        href: "/social",
        label: "Open Social Studio",
        description: "Draft and schedule content for the team.",
        icon: Sparkles,
      };
    default:
      return {
        href: "/atlas",
        label: "Start an Atlas chat",
        description: "Ask Atlas anything to get going.",
        icon: MessageCircle,
      };
  }
}
