import Link from "next/link";
import {
  ArrowLeft,
  Chrome,
  Globe,
  Puzzle,
  Route,
  ShieldCheck,
} from "lucide-react";

import { AuditLogPanel, CompanionClient } from "@/components/companion/CompanionClient";
import { PairExtensionPanel } from "@/components/companion/PairExtensionPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { PUBLIC_ENV } from "@/lib/env";
import { getEffectiveProfile } from "@/lib/impersonation";
import type { UserRole } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// Allowed capture domains. The companion content script only runs on these
// Loan Factory portal hosts; this list is shown for transparency and matches
// the extension manifest's content_scripts matches.
const ALLOWED_DOMAINS = [
  "*.loanfactory.com",
  "*.myloanfactory.com",
];

// Honest role -> assistant routing explainer. Every role currently routes to
// Atlas (the working AI) with a role-appropriate framing. Dedicated
// FLO/Coordinator assistants map onto Atlas assistants when configured later.
const ROUTING_EXPLAINER: {
  role: string;
  matches: UserRole[];
  target: string;
  framing: string;
}[] = [
  {
    role: "Owner / Admin",
    matches: ["owner", "admin"],
    target: "Atlas (owner framing)",
    framing: "Owner / team-lead perspective on the captured portal context.",
  },
  {
    role: "Loan Officer",
    matches: ["loan_officer"],
    target: "Atlas (LO framing)",
    framing: "Move the loan forward: next steps, borrower follow-up, structuring.",
  },
  {
    role: "Processor",
    matches: ["processor"],
    target: "Atlas (FLO / processor framing)",
    framing: "Process the file: conditions, documents, status, stips.",
  },
  {
    role: "Coordinator",
    matches: ["coordinator"],
    target: "Atlas (coordinator framing)",
    framing: "Coordinate the file: scheduling, communication, task hand-offs.",
  },
];

export default async function BrowserCompanionSetupPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

  const canViewAudit = profile.role === "owner" || profile.role === "admin";
  const appName = PUBLIC_ENV.APP_NAME;
  const baseUrl = PUBLIC_ENV.APP_URL;

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Browser Companion · Setup"
        title="Pair, install, and route"
        description="Pair this browser, install the Chrome companion, and review how captures route to the right assistant. Everything here uses your existing LegendsOS session — the extension stores no tokens."
        action={
          <Link href="/browser-companion" className="btn-ghost text-xs">
            <ArrowLeft size={13} />
            Back to companion
          </Link>
        }
      />

      {/* Pair this browser (client island — registers via /session). */}
      <PairExtensionPanel />

      {/* Your status + signed-in identity. */}
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your status</h2>
            <p>Who the companion will act as when it captures and routes.</p>
          </div>
          <StatusPill status="ok" label="signed in" />
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex flex-wrap gap-2">
            <dt className="label">User</dt>
            <dd className="text-ink-900 dark:text-ink-100">
              {profile.full_name ?? profile.email}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="label">Role</dt>
            <dd className="text-ink-900 dark:text-ink-100">
              {profile.role.replace(/_/g, " ")}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="label">Workspace</dt>
            <dd className="break-all text-ink-700 dark:text-ink-300">
              {baseUrl}
            </dd>
          </div>
        </dl>
      </section>

      {/* Allowed capture domains. */}
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Allowed domains</h2>
            <p>
              The companion only captures on these Loan Factory portal hosts. It
              does not run anywhere else.
            </p>
          </div>
          <Globe size={16} className="text-ink-400" />
        </div>
        <ul className="mt-4 grid gap-1.5">
          {ALLOWED_DOMAINS.map((domain) => (
            <li
              key={domain}
              className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-xs dark:border-ink-800 dark:bg-ink-950/40"
            >
              <ShieldCheck size={13} className="text-accent-gold" />
              <span className="font-mono text-ink-800 dark:text-ink-200">
                {domain}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-500 dark:text-ink-400">
          Captures never include borrower PII beyond the text you explicitly
          select. The companion sends only the page URL, title, and your
          selection.
        </p>
      </section>

      {/* Assistant routing explainer. */}
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>How captures route</h2>
            <p>
              Each role sends captures to the right assistant with a tailored
              framing. Atlas is the working AI today; FLO and Coordinator framings
              run on Atlas until dedicated assistants are configured.
            </p>
          </div>
          <Route size={16} className="text-ink-400" />
        </div>
        <ul className="mt-4 grid gap-2">
          {ROUTING_EXPLAINER.map((row) => {
            const isYou = row.matches.includes(profile.role);
            return (
              <li
                key={row.role}
                className={`rounded-xl border p-3 ${
                  isYou
                    ? "border-accent-gold/40 bg-accent-gold/5"
                    : "border-ink-200 bg-white/70 dark:border-ink-800 dark:bg-ink-950/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    {row.role}
                    {isYou && (
                      <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent-gold">
                        you
                      </span>
                    )}
                  </span>
                  <span className="chip">{row.target}</span>
                </div>
                <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                  {row.framing}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Last captures — reuse the companion client so the list, states, and
          role-aware routing are identical to the main page. */}
      <CompanionClient
        role={profile.role}
        appName={appName}
        baseUrl={baseUrl}
      />

      {/* Audit log — owner/admin only (client island, honest "owner only"). */}
      <AuditLogPanel canView={canViewAudit} />

      {/* Chrome install instructions. */}
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Install the Chrome companion</h2>
            <p>Load the unpacked extension during the beta.</p>
          </div>
          <Chrome size={16} className="text-ink-400" />
        </div>
        <ol className="mt-4 grid gap-2 text-sm text-ink-700 dark:text-ink-300">
          <InstallStep n={1}>
            Open <code className="chip font-mono">chrome://extensions</code> in
            Chrome (or Edge).
          </InstallStep>
          <InstallStep n={2}>
            Turn on <span className="font-medium">Developer mode</span> (top
            right).
          </InstallStep>
          <InstallStep n={3}>
            Click <span className="font-medium">Load unpacked</span> and select
            the{" "}
            <code className="chip font-mono">
              extensions/legendsos-browser-companion
            </code>{" "}
            folder from this repository.
          </InstallStep>
          <InstallStep n={4}>
            Make sure you are signed in to {appName} at{" "}
            <span className="break-all">{baseUrl}</span> in the same browser,
            then click <span className="font-medium">Pair extension</span> above.
          </InstallStep>
          <InstallStep n={5}>
            Open a Loan Factory portal page, select the text you want, and use
            the companion to capture and route it.
          </InstallStep>
        </ol>
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[11px] text-ink-600 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
          <Puzzle size={13} className="text-accent-gold" />
          A Chrome Web Store listing will replace the unpacked install later. The
          extension never stores tokens — it authenticates with your existing
          {` ${appName}`} session cookie.
        </p>
      </section>
    </div>
  );
}

function InstallStep({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-accent-gold/30 bg-accent-gold/10 text-[11px] font-semibold text-accent-gold">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
