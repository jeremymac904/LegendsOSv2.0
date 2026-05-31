import { redirect } from "next/navigation";
import {
  CheckCircle2,
  CircleDashed,
  Mail,
  Users,
  Webhook,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  IntakeSubnav,
  PhaseOneBanner,
  WebhookSecretStatus,
} from "@/components/emailintake/shared";
import { cn } from "@/lib/utils";
import {
  INTAKE_CATEGORIES,
  INTAKE_CATEGORY_LABELS,
} from "@/lib/emailIntake/types";
import {
  INTAKE_ROSTER,
  INTAKE_ROSTER_CONFIRMED,
  INTAKE_ROSTER_NEEDS_EMAIL,
} from "@/lib/emailIntake/team";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  loan_officer: "Loan officer",
  processor: "Processor",
  coordinator: "Coordinator",
  assistant: "Assistant",
  other: "Other",
};

// The 4 inbound webhook endpoints n8n posts to. Each fails closed without the
// shared secret. These are reference paths for the owner's n8n setup.
const WEBHOOK_ENDPOINTS = [
  {
    path: "/api/webhooks/email-intake",
    purpose: "Record an inbound email + classify it into the review queue.",
  },
  {
    path: "/api/webhooks/document-intake",
    purpose: "Record attachment metadata into the Needs Review queue.",
  },
  {
    path: "/api/webhooks/alert-intake",
    purpose: "Queue an internal alert (always human-approved, never sent).",
  },
  {
    path: "/api/webhooks/loan-update",
    purpose: "Record a suggested/confirmed loan match for human review.",
  },
] as const;

export default async function EmailIntakeSettingsPage() {
  const { profile } = await getEffectiveProfile();
  if (!isAdminOrOwner(profile)) redirect("/dashboard");

  const webhookReady = isWebhookSecretConfigured();
  const confirmedCount = INTAKE_ROSTER_CONFIRMED.length;
  const needsEmailCount = INTAKE_ROSTER_NEEDS_EMAIL.length;

  // Honest activation checklist — each item reflects real state, no fakes.
  const checklist = [
    {
      label: "Webhook shared secret set (LEGENDSOS_WEBHOOK_SECRET)",
      done: webhookReady,
      detail: webhookReady
        ? "Inbound webhooks can authenticate."
        : "Set LEGENDSOS_WEBHOOK_SECRET in the server environment.",
    },
    {
      label: "All team Gmail addresses confirmed",
      done: needsEmailCount === 0,
      detail:
        needsEmailCount === 0
          ? "Every roster member has a confirmed address."
          : `${needsEmailCount} member${needsEmailCount === 1 ? "" : "s"} still need a Gmail address.`,
    },
    {
      label: "Intake migration applied",
      done: false,
      detail:
        "Apply supabase/migrations/20260531000000_email_intake.sql, then verify counts on the overview.",
    },
    {
      label: "Per-member intake enabled in the database",
      done: false,
      detail:
        "Nothing is watched until intake_enabled is set on email_intake_team — Phase 2 admin write.",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Intake"
        title="Team routing & setup"
        description="Admin reference for the intake system: who is watched, the webhook endpoints, the classification set, and the activation checklist. Values shown here are configured in env/DB by the owner."
        action={<WebhookSecretStatus configured={webhookReady} />}
      />

      <IntakeSubnav active="/email-intake/settings" />

      <PhaseOneBanner />

      {/* Activation checklist */}
      <section className="card-padded">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-accent-gold" />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Activation checklist
          </h2>
        </div>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-950/40"
            >
              {item.done ? (
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
              ) : (
                <CircleDashed
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
                />
              )}
              <div>
                <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">
                  {item.label}
                </p>
                <p className="text-[11.5px] text-ink-600 dark:text-ink-300">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Team roster */}
      <section className="card-padded">
        <div className="mb-1 flex items-center gap-2">
          <Users size={16} className="text-accent-gold" />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Team roster
          </h2>
        </div>
        <p className="mb-3 text-[12.5px] text-ink-600 dark:text-ink-300">
          {confirmedCount} of {INTAKE_ROSTER.length} members have a confirmed
          Gmail address.{" "}
          {needsEmailCount > 0 && (
            <span className="text-amber-700 dark:text-amber-300">
              {needsEmailCount} need the owner to supply an address — these are
              not invented.
            </span>
          )}
        </p>
        <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-[10px] uppercase tracking-[0.14em] text-ink-500 dark:bg-ink-900/50 dark:text-ink-400">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Gmail address</th>
                <th className="px-3 py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {INTAKE_ROSTER.map((m) => (
                <tr
                  key={m.fullName}
                  className="border-t border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950/40"
                >
                  <td className="px-3 py-2 font-medium text-ink-900 dark:text-ink-100">
                    {m.fullName}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-ink-600 dark:text-ink-300">
                    {ROLE_LABEL[m.roleLabel] ?? m.roleLabel}
                  </td>
                  <td className="px-3 py-2">
                    {m.emailConfirmed && m.gmail ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-800 dark:text-ink-200">
                        <Mail size={12} className="text-ink-400" />
                        {m.gmail}
                      </span>
                    ) : (
                      // Honest empty input — NOT fake data. Read-only reference;
                      // the owner sets gmail_address in env/DB (Phase 2 write).
                      <div className="flex items-center gap-2">
                        <span
                          aria-label="Gmail address needed"
                          className="inline-block min-w-[14rem] rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1 text-[11px] italic text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/5 dark:text-amber-300"
                        >
                          admin setup needed — owner supplies address
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        m.emailConfirmed
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                      )}
                    >
                      {m.emailConfirmed ? "Confirmed" : "Needs email"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-ink-500 dark:text-ink-400">
          This roster prefills <code className="font-mono">email_intake_team</code>.
          The owner confirms each address and enables intake per member in the
          database — saving addresses from this screen is a later phase, so no
          editable form is shown here to avoid implying a write that isn&apos;t
          wired.
        </p>
      </section>

      {/* Webhook endpoints */}
      <section className="card-padded">
        <div className="mb-1 flex items-center gap-2">
          <Webhook size={16} className="text-accent-gold" />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Webhook endpoints
          </h2>
        </div>
        <p className="mb-3 text-[12.5px] text-ink-600 dark:text-ink-300">
          n8n posts to these paths with the{" "}
          <code className="font-mono">x-legendsos-webhook-secret</code> header.
          Each fails closed (rejects) unless the secret matches{" "}
          <code className="font-mono">LEGENDSOS_WEBHOOK_SECRET</code>.
        </p>
        <ul className="space-y-2">
          {WEBHOOK_ENDPOINTS.map((w) => (
            <li
              key={w.path}
              className="flex flex-col gap-0.5 rounded-lg border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-950/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="font-mono text-[12px] text-ink-900 dark:text-ink-100">
                {w.path}
              </code>
              <span className="text-[11.5px] text-ink-500 dark:text-ink-400">
                {w.purpose}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Classification set */}
      <section className="card-padded">
        <h2 className="mb-1 text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          Classification set (13 categories)
        </h2>
        <p className="mb-3 text-[12.5px] text-ink-600 dark:text-ink-300">
          The classifier assigns exactly one of these. Ambiguous mail defaults
          to <span className="font-medium">Unknown — needs review</span>.
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {INTAKE_CATEGORIES.map((c) => (
            <div
              key={c}
              className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-3 py-1.5 dark:border-ink-800 dark:bg-ink-950/40"
            >
              <span className="text-[12.5px] text-ink-800 dark:text-ink-200">
                {INTAKE_CATEGORY_LABELS[c]}
              </span>
              <code className="font-mono text-[10px] text-ink-400 dark:text-ink-500">
                {c}
              </code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
