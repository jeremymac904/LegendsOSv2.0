// LegendsOS v2 — Gmail AI Intake shared UI bits.
// -------------------------------------------------------------------------
// Small presentational pieces reused across the four /email-intake routes.
// Server-component safe (no "use client"): pure render, dual light/dark
// classes, high-contrast. Nothing here writes or sends — Phase 1 is
// record + queue for human review only.

import Link from "next/link";
import {
  AlertTriangle,
  DatabaseZap,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  INTAKE_CATEGORY_LABELS,
  type IntakeCategory,
} from "@/lib/emailIntake/types";

// ---------------------------------------------------------------------------
// Classification chip — colour-coded per category family so the queue scans
// fast. Falls back to a neutral chip for unknown/null.
// ---------------------------------------------------------------------------

const CATEGORY_TONE: Record<IntakeCategory, string> = {
  customer_document_returned:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  customer_question:
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300",
  underwriting_condition:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  lender_update:
    "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300",
  title_update:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300",
  insurance_update:
    "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300",
  realtor_update:
    "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-300",
  processor_internal:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300",
  new_lead:
    "border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300",
  promotional:
    "border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-300",
  spam:
    "border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400",
  phishing_risk:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  unknown_needs_review:
    "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300",
};

export function ClassificationChip({
  category,
  className,
}: {
  category: IntakeCategory | null | undefined;
  className?: string;
}) {
  if (!category) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
          "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300",
          className
        )}
      >
        Unclassified
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        CATEGORY_TONE[category],
        className
      )}
    >
      {INTAKE_CATEGORY_LABELS[category]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confidence pill — renders a 0..1 confidence as a percentage, muted when
// null. Low confidence reads warm so reviewers know to double-check.
// ---------------------------------------------------------------------------

export function ConfidencePill({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-[11px] text-ink-400 dark:text-ink-500", className)}>
        —
      </span>
    );
  }
  const pct = Math.round(value * 100);
  const tone =
    pct >= 80
      ? "text-emerald-700 dark:text-emerald-300"
      : pct >= 50
        ? "text-amber-700 dark:text-amber-300"
        : "text-orange-700 dark:text-orange-300";
  return (
    <span className={cn("text-[11px] font-medium tabular-nums", tone, className)}>
      {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Migration-not-applied empty state — shown when an intake table query errors
// because supabase/migrations/20260531000000_email_intake.sql isn't applied.
// Honest, no crash.
// ---------------------------------------------------------------------------

export function MigrationNotice({
  surface,
}: {
  surface: string;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        <DatabaseZap size={18} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          Migration not applied yet
        </p>
        <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
          The {surface} can&apos;t load because the intake tables don&apos;t exist
          yet. Apply{" "}
          <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[11px] text-ink-700 dark:bg-ink-800 dark:text-ink-200">
            supabase/migrations/20260531000000_email_intake.sql
          </code>{" "}
          to the database, then reload.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase-1 banner — the load-bearing safety reminder. Review queue only.
// ---------------------------------------------------------------------------

export function PhaseOneBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10",
        className
      )}
    >
      <ShieldCheck
        size={16}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
      />
      <div className="text-[12.5px] leading-relaxed">
        <p className="font-semibold text-amber-800 dark:text-amber-200">
          Phase 1 — review queue only
        </p>
        <p className="text-amber-700 dark:text-amber-300/90">
          No customer-facing sends, no deletes, no marking emails read, no
          auto-writes to borrower folders. This system records and queues emails
          for human review. Downstream workflows are inactive.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase-2 tag — used wherever an action affordance exists but is intentionally
// inert in Phase 1. Pairs with a disabled control so there are no dead buttons.
// ---------------------------------------------------------------------------

export function PhaseTwoTag({ label = "Phase 2" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Webhook secret status pill — green when configured, warm when not.
// ---------------------------------------------------------------------------

export function WebhookSecretStatus({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        configured
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
      )}
    >
      {configured ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
      Webhook secret {configured ? "configured" : "not set"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-nav — compact links across the four intake surfaces.
// ---------------------------------------------------------------------------

const SUBNAV = [
  { href: "/email-intake", label: "Overview" },
  { href: "/email-intake/review", label: "Review queue" },
  { href: "/email-intake/attachments", label: "Attachments" },
  { href: "/email-intake/settings", label: "Team & setup" },
] as const;

export function IntakeSubnav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {SUBNAV.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              isActive
                ? "border-accent-gold/50 bg-accent-gold/10 text-ink-900 dark:text-ink-100"
                : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300 dark:hover:text-ink-100"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sample-data badge — anything seeded for demo carries is_sample=true and must
// read as clearly fake.
// ---------------------------------------------------------------------------

export function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300">
      <AlertTriangle size={10} /> Sample
    </span>
  );
}
