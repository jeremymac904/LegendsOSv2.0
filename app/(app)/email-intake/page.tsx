import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Inbox,
  Mail,
  Paperclip,
  Settings2,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import {
  IntakeSubnav,
  MigrationNotice,
  PhaseOneBanner,
  WebhookSecretStatus,
} from "@/components/emailintake/shared";
import {
  INTAKE_CATEGORIES,
  INTAKE_CATEGORY_LABELS,
} from "@/lib/emailIntake/types";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Status buckets surfaced in the metric strip. Order matters — review-first.
const STATUS_BUCKETS: { key: string; label: string; tone: "default" | "ok" | "warn" }[] =
  [
    { key: "needs_review", label: "Needs review", tone: "warn" },
    { key: "awaiting_approval", label: "Awaiting approval", tone: "warn" },
    { key: "classified", label: "Classified", tone: "default" },
    { key: "loan_matched", label: "Loan matched", tone: "ok" },
    { key: "approved", label: "Approved", tone: "ok" },
    { key: "archived", label: "Archived", tone: "default" },
  ];

interface Counts {
  byStatus: Record<string, number>;
  total: number;
  attachmentsPending: number;
  ok: boolean;
}

async function loadCounts(): Promise<Counts> {
  const empty: Counts = {
    byStatus: {},
    total: 0,
    attachmentsPending: 0,
    ok: false,
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("email_intake_messages")
      .select("status");
    if (error) return empty;

    const byStatus: Record<string, number> = {};
    for (const row of data ?? []) {
      const s = (row as { status: string }).status ?? "needs_review";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    // Attachments awaiting review — separate table, guard independently so a
    // missing/empty attachments table never zeroes the message counts.
    let attachmentsPending = 0;
    try {
      const { data: att, error: attErr } = await supabase
        .from("email_intake_attachments")
        .select("status")
        .in("status", ["pending_review", "needs_review", "suspicious"]);
      if (!attErr) attachmentsPending = (att ?? []).length;
    } catch {
      attachmentsPending = 0;
    }

    return {
      byStatus,
      total: (data ?? []).length,
      attachmentsPending,
      ok: true,
    };
  } catch {
    return empty;
  }
}

export default async function EmailIntakeOverviewPage() {
  const { profile } = await getEffectiveProfile();
  if (!isAdminOrOwner(profile)) redirect("/dashboard");

  const counts = await loadCounts();
  const webhookReady = isWebhookSecretConfigured();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Intake"
        title="Gmail AI intake — overview"
        description="AI-assisted triage for the team's inbound mail. Phase 1 records and queues emails for human review only — nothing is sent, deleted, or filed automatically."
        action={<WebhookSecretStatus configured={webhookReady} />}
      />

      <IntakeSubnav active="/email-intake" />

      <PhaseOneBanner />

      {!counts.ok ? (
        <MigrationNotice surface="intake overview" />
      ) : (
        <>
          {/* Compact metric strip — real counts, 0 when empty. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATUS_BUCKETS.map((b) => (
              <StatCard
                key={b.key}
                label={b.label}
                value={counts.byStatus[b.key] ?? 0}
                tone={b.tone}
              />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total recorded"
              value={counts.total}
              icon={Mail}
              hint="All intake messages on file"
            />
            <StatCard
              label="Attachments to review"
              value={counts.attachmentsPending}
              icon={Paperclip}
              tone={counts.attachmentsPending > 0 ? "warn" : "default"}
              hint="Pending / needs-review / suspicious"
            />
            <StatCard
              label="Webhook secret"
              value={webhookReady ? "Set" : "Not set"}
              icon={Settings2}
              tone={webhookReady ? "ok" : "warn"}
              hint="LEGENDSOS_WEBHOOK_SECRET in env"
            />
          </div>
        </>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <IntakeLink
          href="/email-intake/review"
          icon={Inbox}
          title="Review queue"
          description="Triage classified and unknown messages."
        />
        <IntakeLink
          href="/email-intake/attachments"
          icon={Paperclip}
          title="Attachments"
          description="Files awaiting human review before filing."
        />
        <IntakeLink
          href="/email-intake/settings"
          icon={Settings2}
          title="Team & setup"
          description="Roster, webhook endpoints, activation checklist."
        />
      </div>

      {/* Classification legend */}
      <section className="card-padded">
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Classification legend
          </h2>
          <p className="text-[12.5px] text-ink-600 dark:text-ink-300">
            The 13 categories the classifier assigns. Anything ambiguous falls
            back to{" "}
            <span className="font-medium text-ink-800 dark:text-ink-100">
              Unknown — needs review
            </span>{" "}
            — the system never guesses.
          </p>
        </div>
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

function IntakeLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Inbox;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:border-accent-gold/50"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 bg-ink-50 text-accent-gold dark:border-ink-700 dark:bg-ink-800/70">
          <Icon size={16} />
        </div>
        <div>
          <p className="text-[13.5px] font-semibold text-ink-900 dark:text-ink-100">
            {title}
          </p>
          <p className="text-[12px] text-ink-600 dark:text-ink-300">
            {description}
          </p>
        </div>
      </div>
      <ArrowRight
        size={15}
        className="mt-1 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 dark:text-ink-500"
      />
    </Link>
  );
}
